import sharp from 'sharp';

// Compute a simple perceptual hash using sharp
// Resize to 8x8 grayscale, then compute hash based on average
export async function computeImageHash(filePath) {
  const { data } = await sharp(filePath)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Compute difference hash (dHash)
  let hash = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * 9 + x];
      const right = data[y * 9 + x + 1];
      if (left > right) {
        hash |= 1n << BigInt(y * 8 + x);
      }
    }
  }
  return hash.toString(16).padStart(16, '0');
}

export function hammingDistance(hash1, hash2) {
  const h1 = BigInt('0x' + hash1);
  const h2 = BigInt('0x' + hash2);
  let xor = h1 ^ h2;
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}
