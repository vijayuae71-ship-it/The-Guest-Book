/**
 * Apply a filter to an image using Canvas.
 * @param {HTMLImageElement|string} source - Image element or URL
 * @param {string} filterName - Filter name
 * @param {number} intensity - 0-100
 * @returns {Promise<{canvas: HTMLCanvasElement, dataUrl: string, blob: Blob}>}
 */
export async function applyFilter(source, filterName, intensity = 100) {
  const img = typeof source === 'string' ? await loadImage(source) : source;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');

  // Draw original
  ctx.drawImage(img, 0, 0);

  const t = intensity / 100; // 0 to 1

  const filters = {
    original: () => {},
    brighten: () => {
      ctx.filter = `brightness(${1 + 0.3 * t})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
    },
    contrast: () => {
      ctx.filter = `contrast(${1 + 0.5 * t})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
    },
    warmth: () => {
      ctx.filter = `sepia(${0.3 * t}) saturate(${1 + 0.3 * t})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
    },
    cool: () => {
      ctx.filter = `hue-rotate(${20 * t}deg) saturate(${1 - 0.1 * t})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
    },
    vintage: () => {
      ctx.filter = `sepia(${0.5 * t}) contrast(${1 + 0.1 * t}) brightness(${1 - 0.05 * t})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
      // Add vignette
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.width * 0.3,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.7
      );
      gradient.addColorStop(0, `rgba(0,0,0,0)`);
      gradient.addColorStop(1, `rgba(0,0,0,${0.4 * t})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    noir: () => {
      ctx.filter = `grayscale(${0.9 * t}) contrast(${1 + 0.3 * t})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
    },
    vivid: () => {
      ctx.filter = `saturate(${1 + 0.8 * t}) contrast(${1 + 0.1 * t})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
    },
    fade: () => {
      ctx.filter = `brightness(${1 + 0.1 * t}) saturate(${1 - 0.3 * t}) contrast(${1 - 0.1 * t})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
    },
    dramatic: () => {
      ctx.filter = `contrast(${1 + 0.5 * t}) brightness(${1 - 0.1 * t}) saturate(${1 + 0.2 * t})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
      // Dark vignette
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.width * 0.25,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.65
      );
      gradient.addColorStop(0, `rgba(0,0,0,0)`);
      gradient.addColorStop(1, `rgba(0,0,0,${0.5 * t})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    bloom: () => {
      ctx.filter = `brightness(${1 + 0.15 * t}) blur(${0.5 * t}px)`;
      ctx.globalAlpha = 0.3 * t;
      ctx.drawImage(img, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      ctx.drawImage(img, 0, 0);
    },
  };

  if (filters[filterName]) {
    filters[filterName]();
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  return { canvas, dataUrl, blob };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export const FILTER_LIST = [
  { key: 'original', name: 'Original' },
  { key: 'brighten', name: 'Bright' },
  { key: 'contrast', name: 'Contrast' },
  { key: 'warmth', name: 'Warm' },
  { key: 'cool', name: 'Cool' },
  { key: 'vintage', name: 'Vintage' },
  { key: 'noir', name: 'B&W' },
  { key: 'vivid', name: 'Vivid' },
  { key: 'fade', name: 'Fade' },
  { key: 'dramatic', name: 'Drama' },
  { key: 'bloom', name: 'Bloom' },
];
