/**
 * ReelGenerator - Generates video reels from photos using Canvas + MediaRecorder
 * Supports optional background music via Web Audio API
 */
export default class ReelGenerator {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fps = options.fps || 30;
    this.photoDuration = options.photoDuration || 3000;
    this.transitionDuration = options.transitionDuration || 500;
    this.transition = options.transition || 'fade';
    this.width = options.width || 1080;
    this.height = options.height || 1920;
    this.musicBlob = options.musicBlob || null; // WAV Blob for background music

    canvas.width = this.width;
    canvas.height = this.height;
  }

  async generate(photoUrls, onProgress) {
    const images = await this._preloadImages(photoUrls, onProgress);
    if (images.length === 0) throw new Error('No images loaded');

    onProgress?.({ phase: 'generating', progress: 0 });

    // Calculate total duration for music
    const totalDurationMs =
      images.length * this.photoDuration +
      (images.length - 1) * this.transitionDuration;

    // Set up combined stream (video + optional audio)
    const videoStream = this.canvas.captureStream(this.fps);
    let combinedStream = videoStream;
    let audioCtx = null;
    let audioSource = null;

    if (this.musicBlob) {
      try {
        audioCtx = new AudioContext();
        const arrayBuffer = await this.musicBlob.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // Create audio source and destination for MediaRecorder
        const dest = audioCtx.createMediaStreamDestination();
        audioSource = audioCtx.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.loop = true; // Loop if music is shorter than reel

        // Add a gentle fade-in and fade-out
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + 0.5);
        // Schedule fade-out near the end
        const endTime = totalDurationMs / 1000;
        gainNode.gain.setValueAtTime(0.7, audioCtx.currentTime + Math.max(0, endTime - 1.5));
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + endTime);

        audioSource.connect(gainNode);
        gainNode.connect(dest);
        audioSource.start(0);

        // Combine video + audio tracks into one stream
        const audioTracks = dest.stream.getAudioTracks();
        const videoTracks = videoStream.getVideoTracks();
        combinedStream = new MediaStream([...videoTracks, ...audioTracks]);
      } catch (err) {
        console.warn('Failed to set up audio, recording without music:', err);
        // Fall back to video-only
        combinedStream = videoStream;
      }
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 4000000,
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return new Promise((resolve, reject) => {
      recorder.onerror = () => reject(new Error('Recording failed'));

      recorder.onstop = () => {
        // Clean up audio
        if (audioSource) {
          try { audioSource.stop(); } catch {}
        }
        if (audioCtx) {
          try { audioCtx.close(); } catch {}
        }

        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        onProgress?.({ phase: 'complete', progress: 100 });
        resolve(url);
      };

      recorder.start();

      this._animate(images, onProgress)
        .then(() => {
          setTimeout(() => recorder.stop(), 200);
        })
        .catch(reject);
    });
  }

  async _preloadImages(urls, onProgress) {
    const images = [];
    for (let i = 0; i < urls.length; i++) {
      onProgress?.({
        phase: 'loading',
        progress: Math.round((i / urls.length) * 100),
        detail: `Loading photo ${i + 1}/${urls.length}`,
      });
      try {
        const img = await this._loadImage(urls[i]);
        images.push(img);
      } catch {
        console.warn(`Failed to load image: ${urls[i]}`);
      }
    }
    return images;
  }

  _loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // Only set crossOrigin for external URLs to avoid tainting canvas
      if (url.startsWith('http') && !url.startsWith(window.location.origin)) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async _animate(images, onProgress) {
    const totalDuration =
      images.length * this.photoDuration +
      (images.length - 1) * this.transitionDuration;
    const totalFrames = Math.round((totalDuration / 1000) * this.fps);
    let frameCount = 0;

    for (let i = 0; i < images.length; i++) {
      const isLast = i === images.length - 1;

      // Display phase
      const displayFrames = Math.round((this.photoDuration / 1000) * this.fps);
      for (let f = 0; f < displayFrames; f++) {
        const t = f / displayFrames;

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.transition === 'kenburns') {
          this._drawKenBurns(images[i], t);
        } else {
          this._drawCover(images[i]);
        }

        frameCount++;
        if (frameCount % 10 === 0) {
          onProgress?.({
            phase: 'generating',
            progress: Math.round((frameCount / totalFrames) * 100),
          });
        }
        await this._waitFrame();
      }

      // Transition phase
      if (!isLast) {
        const transFrames = Math.round(
          (this.transitionDuration / 1000) * this.fps
        );
        for (let f = 0; f < transFrames; f++) {
          const t = f / transFrames;

          this.ctx.clearRect(0, 0, this.width, this.height);
          this.ctx.fillStyle = '#000';
          this.ctx.fillRect(0, 0, this.width, this.height);

          this._drawTransition(images[i], images[i + 1], t);

          frameCount++;
          await this._waitFrame();
        }
      }
    }
  }

  _drawTransition(imgFrom, imgTo, t) {
    switch (this.transition) {
      case 'slide':
        this._drawSlide(imgFrom, imgTo, t);
        break;
      case 'zoom':
        this._drawZoom(imgFrom, imgTo, t);
        break;
      case 'kenburns':
        this._drawKenBurnsTransition(imgFrom, imgTo, t);
        break;
      case 'fade':
      default:
        this._drawFade(imgFrom, imgTo, t);
        break;
    }
  }

  _drawFade(imgFrom, imgTo, t) {
    this.ctx.globalAlpha = 1 - t;
    this._drawCover(imgFrom);
    this.ctx.globalAlpha = t;
    this._drawCover(imgTo);
    this.ctx.globalAlpha = 1;
  }

  _drawSlide(imgFrom, imgTo, t) {
    const eased = this._easeInOut(t);
    const offset = eased * this.width;
    this.ctx.save();
    this.ctx.translate(-offset, 0);
    this._drawCover(imgFrom);
    this.ctx.translate(this.width, 0);
    this._drawCover(imgTo);
    this.ctx.restore();
  }

  _drawZoom(imgFrom, imgTo, t) {
    const eased = this._easeInOut(t);
    this.ctx.save();
    this.ctx.globalAlpha = 1 - eased;
    const scaleFrom = 1 + eased * 0.3;
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(scaleFrom, scaleFrom);
    this.ctx.translate(-this.width / 2, -this.height / 2);
    this._drawCover(imgFrom);
    this.ctx.restore();

    this.ctx.save();
    this.ctx.globalAlpha = eased;
    const scaleTo = 0.7 + eased * 0.3;
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(scaleTo, scaleTo);
    this.ctx.translate(-this.width / 2, -this.height / 2);
    this._drawCover(imgTo);
    this.ctx.restore();

    this.ctx.globalAlpha = 1;
  }

  _drawKenBurns(img, t) {
    const scale = 1 + t * 0.1;
    const panX = t * 0.05 * this.width;
    const panY = t * 0.03 * this.height;
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-this.width / 2 - panX, -this.height / 2 - panY);
    this._drawCover(img);
    this.ctx.restore();
  }

  _drawKenBurnsTransition(imgFrom, imgTo, t) {
    this.ctx.globalAlpha = 1 - t;
    this._drawKenBurns(imgFrom, 1);
    this.ctx.globalAlpha = t;
    this._drawKenBurns(imgTo, 0);
    this.ctx.globalAlpha = 1;
  }

  _drawCover(img) {
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = this.width / this.height;
    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;

    if (imgRatio > canvasRatio) {
      sw = img.naturalHeight * canvasRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / canvasRatio;
      sy = (img.naturalHeight - sh) / 2;
    }

    this.ctx.drawImage(img, sx, sy, sw, sh, 0, 0, this.width, this.height);
  }

  _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  _waitFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
}
