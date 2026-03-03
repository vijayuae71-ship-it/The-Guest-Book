import sharp from 'sharp';

// Score a photo for highlight potential (0-100)
export async function scorePhoto(filePath, metadata = {}) {
  try {
    const img = sharp(filePath);
    const stats = await img.stats();
    const meta = await img.metadata();

    let score = 50; // base score

    // 1. Sharpness estimate from channel entropy
    const avgEntropy = stats.channels.reduce((sum, ch) => sum + (ch.stdev || 0), 0) / stats.channels.length;
    // Higher std dev = more detail = sharper
    score += Math.min(15, avgEntropy / 5);

    // 2. Resolution bonus
    const megapixels = ((meta.width || 0) * (meta.height || 0)) / 1_000_000;
    if (megapixels > 8) score += 10;
    else if (megapixels > 3) score += 5;

    // 3. Brightness - not too dark, not too blown out
    const avgMean = stats.channels.reduce((sum, ch) => sum + (ch.mean || 0), 0) / stats.channels.length;
    if (avgMean > 40 && avgMean < 220) score += 10; // well-exposed
    else if (avgMean < 20 || avgMean > 240) score -= 10; // very dark or blown out

    // 4. Face count bonus (from metadata)
    const faceCount = metadata.faceCount || 0;
    if (faceCount > 0) score += Math.min(15, faceCount * 5);

    return Math.max(0, Math.min(100, Math.round(score)));
  } catch (err) {
    console.error('Photo scoring error:', err);
    return 50; // default score on error
  }
}
