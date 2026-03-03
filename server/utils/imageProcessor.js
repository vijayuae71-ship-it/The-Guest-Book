import sharp from 'sharp';
import exifr from 'exifr';
import path from 'path';

/**
 * Process an uploaded image: create thumbnail, extract metadata, auto-rotate.
 * @param {string} filePath - Absolute path to the uploaded image
 * @param {string} outputDir - Directory to write the thumbnail into
 * @returns {Promise<{thumbnail: string, width: number, height: number, takenAt: string|null}>}
 */
export async function processImage(filePath, outputDir) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const thumbnailFilename = `${base}_thumb.jpg`;
  const thumbnailPath = path.join(outputDir, thumbnailFilename);

  // Create thumbnail (300px cover fit, JPEG quality 80, auto-rotate)
  await sharp(filePath)
    .rotate() // auto-rotate based on EXIF orientation
    .resize(300, 300, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);

  // Get full image dimensions (after auto-rotation)
  const metadata = await sharp(filePath).rotate().metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  // Extract EXIF date and GPS coordinates
  let takenAt = null;
  let latitude = null;
  let longitude = null;
  try {
    const exif = await exifr.parse(filePath, {
      pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'],
      gps: true,
    });
    if (exif) {
      const dateVal = exif.DateTimeOriginal || exif.CreateDate;
      if (dateVal instanceof Date) {
        takenAt = dateVal.toISOString();
      } else if (typeof dateVal === 'string') {
        takenAt = dateVal;
      }
      if (typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
        latitude = exif.latitude;
        longitude = exif.longitude;
      }
    }
  } catch {
    // EXIF extraction can fail for certain formats; that's okay
  }

  // Auto-rotate the original file in place
  const rotatedBuffer = await sharp(filePath).rotate().toBuffer();
  await sharp(rotatedBuffer).toFile(filePath);

  return {
    thumbnail: thumbnailFilename,
    width,
    height,
    takenAt,
    latitude,
    longitude,
  };
}
