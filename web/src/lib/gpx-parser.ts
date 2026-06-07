import { haversineDistance } from './geo';
import type { GpxPoint, TrackPoint } from './types';

export function parseGpx(gpxContent: string): GpxPoint[] {
  const points: GpxPoint[] = [];

  const trkptRegex =
    /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*(?:\/>|>([\s\S]*?)<\/trkpt>)/gi;
  let match;

  while ((match = trkptRegex.exec(gpxContent)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const inner = match[3] || '';

    let ele: number | null = null;
    const eleMatch = inner.match(/<ele>([^<]+)<\/ele>/);
    if (eleMatch) {
      ele = parseFloat(eleMatch[1]);
    }

    if (!isNaN(lat) && !isNaN(lon)) {
      points.push({ lat, lon, ele });
    }
  }

  if (points.length === 0) {
    const rteptRegex =
      /<rtept\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*(?:\/>|>([\s\S]*?)<\/rtept>)/gi;
    while ((match = rteptRegex.exec(gpxContent)) !== null) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        points.push({ lat, lon, ele: null });
      }
    }
  }

  return points;
}

export function buildTrackWithDistances(points: GpxPoint[]): TrackPoint[] {
  if (points.length === 0) return [];

  const result: TrackPoint[] = [{ ...points[0], cumulDist: 0 }];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segDist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    result.push({ ...curr, cumulDist: result[i - 1].cumulDist + segDist });
  }

  return result;
}
