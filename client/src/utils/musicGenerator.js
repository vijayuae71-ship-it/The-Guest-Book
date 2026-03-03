/**
 * MusicGenerator - Generates short background music tracks using the Web Audio API.
 * Runs entirely in the browser with no external dependencies.
 */

// ---------------------------------------------------------------------------
// WAV encoding helpers
// ---------------------------------------------------------------------------

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const data = [];
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      data.push(intSample);
    }
  }

  const dataLength = data.length * bytesPerSample;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    view.setInt16(offset, data[i], true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// ---------------------------------------------------------------------------
// Musical constants
// ---------------------------------------------------------------------------

/** Concert pitch A4 = 440 Hz. Returns frequency for a given MIDI note number. */
function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Pentatonic scale intervals (semitones from root): 0, 2, 4, 7, 9
const PENTATONIC = [0, 2, 4, 7, 9];

/**
 * Build a pentatonic scale starting from a given MIDI root across `octaves` octaves.
 */
function buildPentatonicScale(rootMidi, octaves = 2) {
  const notes = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (const interval of PENTATONIC) {
      notes.push(rootMidi + oct * 12 + interval);
    }
  }
  return notes;
}

/**
 * Simple seeded pseudo-random number generator (mulberry32) so tracks are
 * reproducible for a given style without sounding identical every render.
 */
function seededRandom(seed) {
  let t = (seed + 0x6d2b79f5) | 0;
  return function () {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Style definitions
// ---------------------------------------------------------------------------

const STYLES = [
  {
    key: 'party',
    label: 'Party Vibes',
    description: 'Upbeat synth with driving beat',
    emoji: '\uD83C\uDF89',
    bpm: 128,
  },
  {
    key: 'chill',
    label: 'Chill Sunset',
    description: 'Mellow pads with light rhythm',
    emoji: '\uD83C\uDF05',
    bpm: 90,
  },
  {
    key: 'upbeat',
    label: 'Feel Good',
    description: 'Happy major key melody with bouncy bass',
    emoji: '\uD83D\uDE04',
    bpm: 120,
  },
  {
    key: 'emotional',
    label: 'Moments',
    description: 'Soft piano-like tones with gentle swells',
    emoji: '\uD83D\uDCA7',
    bpm: 80,
  },
  {
    key: 'retro',
    label: 'Retro Wave',
    description: '80s synthwave with arpeggios',
    emoji: '\uD83C\uDF03',
    bpm: 110,
  },
  {
    key: 'none',
    label: 'No Music',
    description: 'Returns silence/null',
    emoji: '\uD83D\uDD07',
    bpm: 0,
  },
];

// ---------------------------------------------------------------------------
// Noise buffer helper
// ---------------------------------------------------------------------------

function createNoiseBuffer(ctx, durationSec) {
  const length = Math.ceil(ctx.sampleRate * durationSec);
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// ADSR envelope helper
// ---------------------------------------------------------------------------

/**
 * Schedule an ADSR envelope on a GainNode.
 * @param {GainNode} gainNode
 * @param {number} startTime - when the note begins (context time)
 * @param {object} env - { attack, decay, sustain, release, duration }
 *   duration = total note-on time (attack + decay + sustain hold).
 *   The release begins at startTime + duration.
 */
function scheduleADSR(gainNode, startTime, env) {
  const { attack, decay, sustain, release, duration, peak = 1 } = env;
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, startTime);
  g.linearRampToValueAtTime(peak, startTime + attack);
  g.linearRampToValueAtTime(sustain * peak, startTime + attack + decay);
  // Hold sustain until note-off
  const noteOff = startTime + duration;
  g.setValueAtTime(sustain * peak, noteOff);
  g.linearRampToValueAtTime(0.0001, noteOff + release);
}

// ---------------------------------------------------------------------------
// Instrument builders - each returns a function that schedules notes
// ---------------------------------------------------------------------------

/**
 * Create a pad instrument (layered detuned oscillators through a filter).
 * Returns a function: playPad(freq, startTime, duration, volume)
 */
function createPadInstrument(ctx, destination, options = {}) {
  const {
    waveform = 'sawtooth',
    filterFreq = 800,
    filterQ = 1,
    detuneSpread = 12,
    voiceCount = 4,
    attack = 0.3,
    decay = 0.2,
    sustain = 0.6,
    release = 0.4,
  } = options;

  return function playPad(freq, startTime, duration, volume = 0.15) {
    const env = { attack, decay, sustain, release, duration, peak: volume };
    const gainNode = ctx.createGain();
    scheduleADSR(gainNode, startTime, env);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);
    filter.Q.setValueAtTime(filterQ, startTime);
    filter.connect(gainNode);
    gainNode.connect(destination);

    for (let v = 0; v < voiceCount; v++) {
      const osc = ctx.createOscillator();
      osc.type = waveform;
      osc.frequency.setValueAtTime(freq, startTime);
      // Spread detuning symmetrically
      const detune = ((v / (voiceCount - 1)) * 2 - 1) * detuneSpread;
      osc.detune.setValueAtTime(detune, startTime);
      osc.connect(filter);
      osc.start(startTime);
      osc.stop(startTime + duration + release + 0.05);
    }
  };
}

/**
 * Create a pluck / piano-like instrument (sine + harmonics with fast decay).
 */
function createPluckInstrument(ctx, destination, options = {}) {
  const {
    harmonics = [1, 2, 3, 5],
    harmonicGains = [1, 0.5, 0.25, 0.1],
    attack = 0.005,
    decay = 0.3,
    sustain = 0.15,
    release = 0.3,
    filterFreq = 2500,
  } = options;

  return function playPluck(freq, startTime, duration, volume = 0.2) {
    const env = { attack, decay, sustain, release, duration, peak: volume };
    const gainNode = ctx.createGain();
    scheduleADSR(gainNode, startTime, env);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);
    // Simulate brightness decay
    filter.frequency.exponentialRampToValueAtTime(
      300,
      startTime + duration + release
    );
    filter.connect(gainNode);
    gainNode.connect(destination);

    harmonics.forEach((h, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * h, startTime);
      const hGain = ctx.createGain();
      hGain.gain.setValueAtTime(harmonicGains[idx] || 0.1, startTime);
      osc.connect(hGain);
      hGain.connect(filter);
      osc.start(startTime);
      osc.stop(startTime + duration + release + 0.05);
    });
  };
}

/**
 * Create a bass instrument (sub oscillator + slightly overdriven layer).
 */
function createBassInstrument(ctx, destination, options = {}) {
  const {
    waveform = 'triangle',
    attack = 0.01,
    decay = 0.15,
    sustain = 0.5,
    release = 0.1,
    filterFreq = 400,
  } = options;

  return function playBass(freq, startTime, duration, volume = 0.25) {
    const env = { attack, decay, sustain, release, duration, peak: volume };
    const gainNode = ctx.createGain();
    scheduleADSR(gainNode, startTime, env);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);
    filter.Q.setValueAtTime(2, startTime);
    filter.connect(gainNode);
    gainNode.connect(destination);

    // Sub layer (sine one octave down)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq, startTime);
    sub.connect(filter);
    sub.start(startTime);
    sub.stop(startTime + duration + release + 0.05);

    // Body layer
    const body = ctx.createOscillator();
    body.type = waveform;
    body.frequency.setValueAtTime(freq, startTime);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.6, startTime);
    body.connect(bodyGain);
    bodyGain.connect(filter);
    body.start(startTime);
    body.stop(startTime + duration + release + 0.05);
  };
}

/**
 * Create a lead synth instrument (bright, with vibrato).
 */
function createLeadInstrument(ctx, destination, options = {}) {
  const {
    waveform = 'sawtooth',
    attack = 0.02,
    decay = 0.1,
    sustain = 0.4,
    release = 0.2,
    filterFreq = 3000,
    vibratoRate = 5,
    vibratoDepth = 6,
  } = options;

  return function playLead(freq, startTime, duration, volume = 0.12) {
    const env = { attack, decay, sustain, release, duration, peak: volume };
    const gainNode = ctx.createGain();
    scheduleADSR(gainNode, startTime, env);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);
    filter.connect(gainNode);
    gainNode.connect(destination);

    const osc = ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.setValueAtTime(freq, startTime);

    // Vibrato LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(vibratoRate, startTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(vibratoDepth, startTime);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);
    lfo.start(startTime);
    lfo.stop(startTime + duration + release + 0.05);

    // Second detuned oscillator for width
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq, startTime);
    osc2.detune.setValueAtTime(7, startTime);
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.3, startTime);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);

    osc.connect(filter);
    osc.start(startTime);
    osc.stop(startTime + duration + release + 0.05);
    osc2.start(startTime);
    osc2.stop(startTime + duration + release + 0.05);
  };
}

// ---------------------------------------------------------------------------
// Drum machine
// ---------------------------------------------------------------------------

function createDrumMachine(ctx, destination) {
  const noiseBuf = createNoiseBuffer(ctx, 2);

  function kick(startTime, volume = 0.35) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, startTime);
    osc.frequency.exponentialRampToValueAtTime(30, startTime + 0.12);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

    // Click transient
    const click = ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(800, startTime);
    click.frequency.exponentialRampToValueAtTime(60, startTime + 0.02);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(volume * 0.6, startTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.03);

    osc.connect(gainNode);
    gainNode.connect(destination);
    click.connect(clickGain);
    clickGain.connect(destination);

    osc.start(startTime);
    osc.stop(startTime + 0.35);
    click.start(startTime);
    click.stop(startTime + 0.05);
  }

  function snare(startTime, volume = 0.2) {
    // Noise component
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1500, startTime);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(destination);

    // Tone component
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, startTime);
    osc.frequency.exponentialRampToValueAtTime(120, startTime + 0.05);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(volume * 0.7, startTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);
    osc.connect(oscGain);
    oscGain.connect(destination);

    noise.start(startTime);
    noise.stop(startTime + 0.2);
    osc.start(startTime);
    osc.stop(startTime + 0.15);
  }

  function hihat(startTime, open = false, volume = 0.08) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(8000, startTime);
    filter.Q.setValueAtTime(3, startTime);
    const gainNode = ctx.createGain();
    const dur = open ? 0.2 : 0.05;
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(destination);
    noise.start(startTime);
    noise.stop(startTime + dur + 0.01);
  }

  return { kick, snare, hihat };
}

// ---------------------------------------------------------------------------
// Style renderers
// ---------------------------------------------------------------------------

/**
 * Party Vibes - 128 BPM, driving four-on-the-floor, bright synth stabs,
 * pulsing bass, energetic feel.
 */
function renderParty(ctx, dest, durationSec) {
  const bpm = 128;
  const beatDur = 60 / bpm;
  const barDur = beatDur * 4;
  const totalBeats = Math.floor(durationSec / beatDur);

  const drums = createDrumMachine(ctx, dest);

  // Chord progression: Cm - Ab - Eb - Bb (i - VI - III - VII in C minor pentatonic friendly)
  // MIDI roots: C3=48, Ab2=44, Eb3=51, Bb2=46
  const chordRoots = [48, 56, 51, 58]; // C, Ab, Eb, Bb (higher voicings)
  const chordIntervals = [0, 3, 7, 12]; // minor triads + octave

  const pad = createPadInstrument(ctx, dest, {
    waveform: 'sawtooth',
    filterFreq: 1200,
    detuneSpread: 15,
    voiceCount: 5,
    attack: 0.05,
    decay: 0.1,
    sustain: 0.7,
    release: 0.15,
  });

  const bass = createBassInstrument(ctx, dest, {
    waveform: 'sawtooth',
    attack: 0.005,
    decay: 0.08,
    sustain: 0.4,
    release: 0.05,
    filterFreq: 600,
  });

  const lead = createLeadInstrument(ctx, dest, {
    waveform: 'sawtooth',
    filterFreq: 4000,
    attack: 0.01,
    decay: 0.05,
    sustain: 0.3,
    release: 0.1,
  });

  const scale = buildPentatonicScale(60, 2); // C4 pentatonic
  const rng = seededRandom(42);

  for (let beat = 0; beat < totalBeats; beat++) {
    const t = beat * beatDur;
    if (t >= durationSec) break;

    const barIndex = Math.floor(beat / 4) % 4;
    const beatInBar = beat % 4;

    // Four-on-the-floor kick
    drums.kick(t, 0.35);

    // Snare on 2 and 4
    if (beatInBar === 1 || beatInBar === 3) {
      drums.snare(t, 0.2);
    }

    // Hi-hat on every 8th note
    drums.hihat(t, false, 0.07);
    drums.hihat(t + beatDur / 2, beatInBar === 2, 0.05);

    // Chord stabs on beats 1 and 3 (off-beat syncopation)
    if (beatInBar === 0 || beatInBar === 2) {
      const root = chordRoots[barIndex];
      chordIntervals.forEach((interval) => {
        pad(midiToFreq(root + interval), t, beatDur * 0.8, 0.06);
      });
    }

    // Pulsing bass - eighth note pattern
    const bassRoot = chordRoots[barIndex] - 12;
    bass(midiToFreq(bassRoot), t, beatDur * 0.4, 0.2);
    if (rng() > 0.3) {
      bass(
        midiToFreq(bassRoot + (rng() > 0.5 ? 7 : 0)),
        t + beatDur / 2,
        beatDur * 0.3,
        0.15
      );
    }

    // Melodic lead on some beats
    if (rng() > 0.5) {
      const noteIdx = Math.floor(rng() * scale.length);
      lead(midiToFreq(scale[noteIdx]), t, beatDur * 0.3, 0.08);
    }
  }
}

/**
 * Chill Sunset - 90 BPM, warm pads, gentle rhythm, relaxed vibe.
 */
function renderChill(ctx, dest, durationSec) {
  const bpm = 90;
  const beatDur = 60 / bpm;
  const barDur = beatDur * 4;
  const totalBars = Math.ceil(durationSec / barDur);

  const drums = createDrumMachine(ctx, dest);

  // Chord progression: Fmaj7 - Am7 - Dm7 - Cmaj7
  // Root MIDI: F3=53, A3=57, D3=50, C3=48
  const chords = [
    [53, 57, 60, 64], // Fmaj7
    [57, 60, 64, 67], // Am7
    [50, 53, 57, 60], // Dm7
    [48, 52, 55, 59], // Cmaj7
  ];

  const pad = createPadInstrument(ctx, dest, {
    waveform: 'sine',
    filterFreq: 600,
    filterQ: 0.5,
    detuneSpread: 8,
    voiceCount: 3,
    attack: 0.8,
    decay: 0.3,
    sustain: 0.7,
    release: 0.8,
  });

  const pluck = createPluckInstrument(ctx, dest, {
    attack: 0.005,
    decay: 0.5,
    sustain: 0.05,
    release: 0.6,
    filterFreq: 2000,
  });

  const bass = createBassInstrument(ctx, dest, {
    waveform: 'sine',
    attack: 0.05,
    decay: 0.2,
    sustain: 0.3,
    release: 0.3,
    filterFreq: 300,
  });

  const scale = buildPentatonicScale(65, 2); // F4 pentatonic
  const rng = seededRandom(77);

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * barDur;
    if (barStart >= durationSec) break;

    const chordIdx = bar % 4;
    const chord = chords[chordIdx];

    // Lush pad - whole bar
    chord.forEach((note) => {
      pad(midiToFreq(note), barStart, barDur * 0.9, 0.07);
    });

    // Bass on beat 1 and sometimes beat 3
    bass(midiToFreq(chord[0] - 12), barStart, beatDur * 1.5, 0.18);
    if (rng() > 0.3) {
      bass(
        midiToFreq(chord[0] - 12),
        barStart + beatDur * 2,
        beatDur * 1,
        0.12
      );
    }

    for (let beat = 0; beat < 4; beat++) {
      const t = barStart + beat * beatDur;
      if (t >= durationSec) break;

      // Soft kick on 1 and 3
      if (beat === 0 || beat === 2) {
        drums.kick(t, 0.15);
      }

      // Gentle snare on 2 and 4 (very soft)
      if (beat === 1 || beat === 3) {
        drums.snare(t, 0.07);
      }

      // Light hi-hat pattern
      if (rng() > 0.3) {
        drums.hihat(t, false, 0.03);
      }
      if (rng() > 0.5) {
        drums.hihat(t + beatDur / 2, false, 0.02);
      }

      // Plucked melody notes
      if (rng() > 0.4) {
        const noteIdx = Math.floor(rng() * scale.length);
        pluck(midiToFreq(scale[noteIdx]), t, beatDur * 0.6, 0.1);
      }
    }
  }
}

/**
 * Feel Good - 120 BPM, happy major key, bouncy bass, uplifting melody.
 */
function renderUpbeat(ctx, dest, durationSec) {
  const bpm = 120;
  const beatDur = 60 / bpm;
  const barDur = beatDur * 4;
  const totalBeats = Math.floor(durationSec / beatDur);

  const drums = createDrumMachine(ctx, dest);

  // Major key progression: C - G - Am - F
  // MIDI: C3=48, G3=55, A3=57, F3=53
  const chords = [
    [48, 52, 55], // C major
    [55, 59, 62], // G major
    [57, 60, 64], // A minor
    [53, 57, 60], // F major
  ];

  const pad = createPadInstrument(ctx, dest, {
    waveform: 'triangle',
    filterFreq: 1000,
    detuneSpread: 10,
    voiceCount: 4,
    attack: 0.1,
    decay: 0.15,
    sustain: 0.6,
    release: 0.2,
  });

  const bass = createBassInstrument(ctx, dest, {
    waveform: 'square',
    attack: 0.01,
    decay: 0.1,
    sustain: 0.3,
    release: 0.08,
    filterFreq: 500,
  });

  const lead = createLeadInstrument(ctx, dest, {
    waveform: 'triangle',
    filterFreq: 3500,
    attack: 0.01,
    decay: 0.08,
    sustain: 0.35,
    release: 0.15,
    vibratoRate: 4,
    vibratoDepth: 4,
  });

  const pluck = createPluckInstrument(ctx, dest, {
    attack: 0.003,
    decay: 0.2,
    sustain: 0.1,
    release: 0.2,
    filterFreq: 3000,
  });

  // C major pentatonic for melody: C D E G A
  const scale = buildPentatonicScale(72, 2); // C5 pentatonic
  const bassScale = buildPentatonicScale(36, 1); // C2

  const rng = seededRandom(123);

  // Pre-compose a repeating 8-beat melody motif
  const motif = [];
  for (let i = 0; i < 8; i++) {
    motif.push({
      noteIdx: Math.floor(rng() * 6),
      play: rng() > 0.25,
      offset: rng() > 0.7 ? beatDur / 2 : 0,
    });
  }

  for (let beat = 0; beat < totalBeats; beat++) {
    const t = beat * beatDur;
    if (t >= durationSec) break;

    const barIndex = Math.floor(beat / 4) % 4;
    const beatInBar = beat % 4;
    const chord = chords[barIndex];

    // Kick on 1 and 3
    if (beatInBar === 0 || beatInBar === 2) {
      drums.kick(t, 0.3);
    }

    // Snare on 2 and 4
    if (beatInBar === 1 || beatInBar === 3) {
      drums.snare(t, 0.15);
    }

    // Hi-hat 8th notes
    drums.hihat(t, false, 0.05);
    drums.hihat(t + beatDur / 2, false, 0.03);

    // Chord pad - on beat 1 of each bar, sustain for the bar
    if (beatInBar === 0) {
      chord.forEach((note) => {
        pad(midiToFreq(note + 12), t, barDur * 0.85, 0.045);
      });
    }

    // Bouncy bass - eighth note pattern with octave jumps
    const bassRoot = chord[0] - 12;
    bass(midiToFreq(bassRoot), t, beatDur * 0.35, 0.2);
    if (beatInBar === 0 || beatInBar === 2) {
      bass(midiToFreq(bassRoot + 12), t + beatDur / 2, beatDur * 0.25, 0.12);
    }

    // Melody using repeating motif
    const m = motif[beat % 8];
    if (m.play) {
      const noteIdx = m.noteIdx % scale.length;
      lead(
        midiToFreq(scale[noteIdx]),
        t + m.offset,
        beatDur * 0.4,
        0.07
      );
    }

    // Occasional pluck accents
    if (rng() > 0.7) {
      const pIdx = Math.floor(rng() * scale.length);
      pluck(midiToFreq(scale[pIdx]), t + beatDur * 0.25, beatDur * 0.3, 0.06);
    }
  }
}

/**
 * Moments - 80 BPM, soft piano-like tones, gentle pads, emotional feel.
 */
function renderEmotional(ctx, dest, durationSec) {
  const bpm = 80;
  const beatDur = 60 / bpm;
  const barDur = beatDur * 4;
  const totalBars = Math.ceil(durationSec / barDur);

  const drums = createDrumMachine(ctx, dest);

  // Emotional progression: Am - F - C - G (vi - IV - I - V)
  const chords = [
    [57, 60, 64, 67], // Am7
    [53, 57, 60, 65], // Fmaj9
    [48, 52, 55, 59], // Cmaj7
    [55, 59, 62, 66], // G7
  ];

  const piano = createPluckInstrument(ctx, dest, {
    harmonics: [1, 2, 3, 4, 5, 6],
    harmonicGains: [1, 0.7, 0.4, 0.2, 0.1, 0.05],
    attack: 0.008,
    decay: 0.6,
    sustain: 0.1,
    release: 0.8,
    filterFreq: 3000,
  });

  const pad = createPadInstrument(ctx, dest, {
    waveform: 'sine',
    filterFreq: 500,
    detuneSpread: 6,
    voiceCount: 3,
    attack: 1.5,
    decay: 0.5,
    sustain: 0.6,
    release: 1.5,
  });

  const bass = createBassInstrument(ctx, dest, {
    waveform: 'sine',
    attack: 0.1,
    decay: 0.3,
    sustain: 0.3,
    release: 0.5,
    filterFreq: 250,
  });

  // A minor pentatonic for melody
  const scale = buildPentatonicScale(69, 2); // A4 pentatonic
  const rng = seededRandom(999);

  // Pre-compose a gentle melody pattern (16 steps)
  const melody = [];
  for (let i = 0; i < 16; i++) {
    melody.push({
      noteIdx: Math.floor(rng() * 7),
      play: rng() > 0.45,
      velocity: 0.06 + rng() * 0.06,
    });
  }

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * barDur;
    if (barStart >= durationSec) break;

    const chordIdx = bar % 4;
    const chord = chords[chordIdx];

    // Soft pad swell - each bar
    chord.forEach((note) => {
      pad(midiToFreq(note - 12), barStart, barDur * 0.95, 0.04);
    });

    // Gentle bass
    bass(midiToFreq(chord[0] - 24), barStart, barDur * 0.7, 0.14);

    // Arpeggiated piano chord pattern
    for (let beat = 0; beat < 4; beat++) {
      const t = barStart + beat * beatDur;
      if (t >= durationSec) break;

      // Very light percussion
      if (beat === 0) {
        drums.kick(t, 0.08);
      }
      if (beat === 2) {
        drums.hihat(t, false, 0.02);
      }

      // Piano arpeggiation - play chord tones sequentially
      const noteIndex = beat % chord.length;
      piano(midiToFreq(chord[noteIndex] + 12), t, beatDur * 0.8, 0.08);

      // Add gentle high melody
      const mStep = (bar * 4 + beat) % 16;
      const m = melody[mStep];
      if (m.play) {
        const sIdx = m.noteIdx % scale.length;
        piano(
          midiToFreq(scale[sIdx]),
          t + beatDur * 0.5,
          beatDur * 0.6,
          m.velocity
        );
      }
    }
  }
}

/**
 * Retro Wave - 110 BPM, 80s synthwave, arpeggios, gated reverb feel.
 */
function renderRetro(ctx, dest, durationSec) {
  const bpm = 110;
  const beatDur = 60 / bpm;
  const barDur = beatDur * 4;
  const totalBeats = Math.floor(durationSec / beatDur);

  const drums = createDrumMachine(ctx, dest);

  // Synthwave progression: Am - F - C - E (dark yet catchy)
  const chordRoots = [57, 53, 48, 52]; // A, F, C, E
  const chordTypes = [
    [0, 3, 7],   // minor
    [0, 4, 7],   // major
    [0, 4, 7],   // major
    [0, 4, 7],   // major
  ];

  // Thick saw pad
  const pad = createPadInstrument(ctx, dest, {
    waveform: 'sawtooth',
    filterFreq: 900,
    filterQ: 2,
    detuneSpread: 20,
    voiceCount: 6,
    attack: 0.2,
    decay: 0.2,
    sustain: 0.7,
    release: 0.3,
  });

  const bass = createBassInstrument(ctx, dest, {
    waveform: 'sawtooth',
    attack: 0.005,
    decay: 0.1,
    sustain: 0.4,
    release: 0.08,
    filterFreq: 500,
  });

  // Arp lead
  const arp = createLeadInstrument(ctx, dest, {
    waveform: 'square',
    filterFreq: 2500,
    attack: 0.005,
    decay: 0.08,
    sustain: 0.25,
    release: 0.1,
    vibratoRate: 0,
    vibratoDepth: 0,
  });

  // Extra shimmer layer for the arpeggio
  const shimmer = createPluckInstrument(ctx, dest, {
    harmonics: [1, 2, 4],
    harmonicGains: [1, 0.3, 0.15],
    attack: 0.003,
    decay: 0.15,
    sustain: 0.05,
    release: 0.15,
    filterFreq: 4000,
  });

  const rng = seededRandom(808);

  // Build arpeggio pattern: chord tones in 16th note pattern
  const arpPattern = [0, 1, 2, 1, 0, 2, 1, 2]; // indices into chord

  for (let beat = 0; beat < totalBeats; beat++) {
    const t = beat * beatDur;
    if (t >= durationSec) break;

    const barIndex = Math.floor(beat / 4) % 4;
    const beatInBar = beat % 4;
    const root = chordRoots[barIndex];
    const intervals = chordTypes[barIndex];

    // Driving kick
    drums.kick(t, 0.3);

    // Snare on 2 and 4 with extra punch
    if (beatInBar === 1 || beatInBar === 3) {
      drums.snare(t, 0.22);
    }

    // Hi-hat 16th notes (quintessential synthwave)
    for (let s = 0; s < 4; s++) {
      const ht = t + (s * beatDur) / 4;
      if (ht >= durationSec) break;
      drums.hihat(ht, false, s === 0 ? 0.06 : 0.03);
    }

    // Chord pad on beat 1, sustain full bar
    if (beatInBar === 0) {
      intervals.forEach((interval) => {
        pad(midiToFreq(root + interval), t, barDur * 0.9, 0.04);
      });
      // Add octave double for richness
      pad(midiToFreq(root + 12), t, barDur * 0.9, 0.02);
    }

    // Bass line - driving eighth notes
    bass(midiToFreq(root - 12), t, beatDur * 0.35, 0.18);
    bass(
      midiToFreq(root - 12 + (beatInBar === 2 ? 7 : 0)),
      t + beatDur / 2,
      beatDur * 0.3,
      0.12
    );

    // 16th note arpeggio
    for (let s = 0; s < 4; s++) {
      const at = t + (s * beatDur) / 4;
      if (at >= durationSec) break;
      const arpIdx = ((beat % 2) * 4 + s) % arpPattern.length;
      const chordTone = intervals[arpPattern[arpIdx]];
      const arpNote = root + 12 + chordTone;
      arp(midiToFreq(arpNote), at, beatDur * 0.2, 0.06);

      // Shimmer layer on alternating 16ths
      if (s % 2 === 0) {
        shimmer(midiToFreq(arpNote + 12), at, beatDur * 0.15, 0.03);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

const RENDERERS = {
  party: renderParty,
  chill: renderChill,
  upbeat: renderUpbeat,
  emotional: renderEmotional,
  retro: renderRetro,
};

class MusicGenerator {
  /**
   * @param {AudioContext} audioContext - A live AudioContext for playback.
   */
  constructor(audioContext) {
    if (!audioContext) {
      throw new Error('MusicGenerator requires an AudioContext instance.');
    }
    this.audioContext = audioContext;
  }

  /**
   * Returns the list of available music styles.
   * @returns {Array<{key: string, label: string, description: string, emoji: string, bpm: number}>}
   */
  static getStyles() {
    return STYLES.map((s) => ({ ...s }));
  }

  /**
   * Generate a music track as an AudioBuffer and a ready-to-play AudioBufferSourceNode.
   *
   * @param {string} style - One of the style keys (e.g. 'party', 'chill', ...).
   * @param {number} durationSec - Duration in seconds (default 15).
   * @returns {Promise<{ audioBuffer: AudioBuffer|null, audioNode: AudioBufferSourceNode|null }>}
   */
  async generateTrack(style, durationSec = 15) {
    if (style === 'none') {
      return { audioBuffer: null, audioNode: null };
    }

    const renderer = RENDERERS[style];
    if (!renderer) {
      throw new Error(
        `Unknown style "${style}". Available: ${Object.keys(RENDERERS).join(', ')}, none`
      );
    }

    const sampleRate = this.audioContext.sampleRate;
    const offlineCtx = new OfflineAudioContext(2, sampleRate * durationSec, sampleRate);

    // Master compressor to glue the mix
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, 0);
    compressor.knee.setValueAtTime(12, 0);
    compressor.ratio.setValueAtTime(4, 0);
    compressor.attack.setValueAtTime(0.003, 0);
    compressor.release.setValueAtTime(0.15, 0);
    compressor.connect(offlineCtx.destination);

    // Master gain
    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(0.85, 0);
    // Fade in (first 0.5s)
    masterGain.gain.setValueAtTime(0.001, 0);
    masterGain.gain.linearRampToValueAtTime(0.85, Math.min(0.5, durationSec * 0.1));
    // Fade out (last 1s)
    const fadeOutStart = Math.max(0, durationSec - 1.0);
    masterGain.gain.setValueAtTime(0.85, fadeOutStart);
    masterGain.gain.linearRampToValueAtTime(0.001, durationSec);
    masterGain.connect(compressor);

    // Render the style
    renderer(offlineCtx, masterGain, durationSec);

    const audioBuffer = await offlineCtx.startRendering();

    // Create a source node from the live context for playback
    const audioNode = this.audioContext.createBufferSource();
    audioNode.buffer = audioBuffer;
    audioNode.loop = true;

    return { audioBuffer, audioNode };
  }

  /**
   * Generate a music track and return it as a WAV Blob.
   * Useful for mixing with MediaRecorder or downloading.
   *
   * @param {string} style - One of the style keys.
   * @param {number} durationSec - Duration in seconds (default 15).
   * @returns {Promise<Blob|null>} - WAV Blob, or null for 'none' style.
   */
  async getTrackBlob(style, durationSec = 15) {
    if (style === 'none') {
      return null;
    }

    const { audioBuffer } = await this.generateTrack(style, durationSec);
    if (!audioBuffer) return null;

    return audioBufferToWav(audioBuffer);
  }
}

export { MusicGenerator, STYLES };
export default MusicGenerator;
