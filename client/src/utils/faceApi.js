// Face API utility - browser-based face detection using @vladmandic/face-api
// Models are loaded from /models/ directory (copied from npm package)

import * as faceapiModule from '@vladmandic/face-api';

const faceapi = faceapiModule;
let modelsLoaded = false;
let loadingPromise = null;

export async function loadFaceModels(onProgress) {
  if (modelsLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // Ensure TensorFlow.js backend is ready
      const tf = faceapi.tf || faceapiModule.tf;
      if (tf) {
        onProgress?.('Initializing AI engine...');
        await tf.ready();
        console.log('[FaceAPI] TF backend:', tf.getBackend());
      }

      onProgress?.('Loading face detector...');
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      onProgress?.('Loading landmark model...');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      onProgress?.('Loading recognition model...');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      modelsLoaded = true;
      onProgress?.('Models ready');
      console.log('[FaceAPI] All models loaded successfully');
      return true;
    } catch (err) {
      console.error('[FaceAPI] Failed to load face models:', err);
      loadingPromise = null;
      throw err;
    }
  })();

  return loadingPromise;
}

export function areModelsLoaded() {
  return modelsLoaded;
}

export async function detectFaces(imageElement) {
  if (!modelsLoaded) {
    throw new Error('Face models not loaded. Call loadFaceModels() first.');
  }

  // Try detection - first pass with standard settings
  let detections = await faceapi
    .detectAllFaces(
      imageElement,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 })
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  // If no detections, try with smaller input (faster, works better with small faces)
  if (detections.length === 0) {
    detections = await faceapi
      .detectAllFaces(
        imageElement,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();
  }

  return detections.map((d) => ({
    descriptor: Array.from(d.descriptor),
    box: {
      x: d.detection.box.x / imageElement.width,
      y: d.detection.box.y / imageElement.height,
      width: d.detection.box.width / imageElement.width,
      height: d.detection.box.height / imageElement.height,
    },
    score: d.detection.score,
    landmarks: d.landmarks.positions.map((p) => ({
      x: p.x / imageElement.width,
      y: p.y / imageElement.height,
    })),
  }));
}

export async function detectSingleFace(imageElement) {
  if (!modelsLoaded) {
    throw new Error('Face models not loaded.');
  }

  const detection = await faceapi
    .detectSingleFace(
      imageElement,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  return {
    descriptor: Array.from(detection.descriptor),
    box: {
      x: detection.detection.box.x / imageElement.width,
      y: detection.detection.box.y / imageElement.height,
      width: detection.detection.box.width / imageElement.width,
      height: detection.detection.box.height / imageElement.height,
    },
    score: detection.detection.score,
  };
}

export function cropFaceFromCanvas(imageElement, box, size = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const natW = imageElement.naturalWidth || imageElement.width;
  const natH = imageElement.naturalHeight || imageElement.height;

  const sx = box.x * natW;
  const sy = box.y * natH;
  const sw = box.width * natW;
  const sh = box.height * natH;

  // Add padding around face for a more natural crop
  const faceSize = Math.max(sw, sh);
  const padding = faceSize * 0.4;

  // Center the crop on the face center
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  const cropSize = faceSize + padding * 2;

  // Clamp to image bounds
  let cropX = Math.max(0, cx - cropSize / 2);
  let cropY = Math.max(0, cy - cropSize / 2);
  let cropW = Math.min(cropSize, natW - cropX);
  let cropH = Math.min(cropSize, natH - cropY);

  ctx.drawImage(imageElement, cropX, cropY, cropW, cropH, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.8);
}
