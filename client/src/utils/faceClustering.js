// Face clustering utility - groups face descriptors by Euclidean distance

export function euclideanDistance(desc1, desc2) {
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += (desc1[i] - desc2[i]) ** 2;
  }
  return Math.sqrt(sum);
}

export function clusterFaces(faces, threshold = 0.55) {
  const clusters = [];

  for (const face of faces) {
    let bestCluster = null;
    let bestDistance = Infinity;

    for (const cluster of clusters) {
      const dist = euclideanDistance(face.descriptor, cluster.centroid);
      if (dist < threshold && dist < bestDistance) {
        bestCluster = cluster;
        bestDistance = dist;
      }
    }

    if (bestCluster) {
      bestCluster.faces.push(face);
      // Recompute centroid as average of all descriptors in cluster
      const len = bestCluster.faces.length;
      bestCluster.centroid = bestCluster.faces[0].descriptor.map((_, i) => {
        let sum = 0;
        for (const f of bestCluster.faces) sum += f.descriptor[i];
        return sum / len;
      });
    } else {
      clusters.push({
        id: crypto.randomUUID(),
        faces: [face],
        centroid: [...face.descriptor],
        label: null,
      });
    }
  }

  return clusters
    .filter((c) => c.faces.length >= 1)
    .sort((a, b) => b.faces.length - a.faces.length);
}

export function getPhotoIdsForCluster(cluster) {
  const ids = new Set();
  for (const face of cluster.faces) {
    ids.add(face.photoId);
  }
  return [...ids];
}

export function findMatchingCluster(descriptor, clusters, threshold = 0.55) {
  let bestCluster = null;
  let bestDistance = Infinity;
  for (const cluster of clusters) {
    const dist = euclideanDistance(descriptor, cluster.centroid);
    if (dist < threshold && dist < bestDistance) {
      bestCluster = cluster;
      bestDistance = dist;
    }
  }
  return bestCluster;
}
