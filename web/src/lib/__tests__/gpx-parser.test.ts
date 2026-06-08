import { describe, it, expect } from 'vitest';
import { parseGpx, buildTrackWithDistances } from '../gpx-parser';
import { haversineDistance } from '../geo';

function makeGpx(
  points: Array<{ lat: number; lon: number; ele?: number }>,
): string {
  const trkpts = points
    .map((p) => {
      const inner = p.ele !== undefined ? `<ele>${p.ele}</ele>` : '';
      return `<trkpt lat="${p.lat}" lon="${p.lon}">${inner}</trkpt>`;
    })
    .join('\n    ');
  return `<?xml version="1.0"?><gpx><trk><trkseg>\n    ${trkpts}\n  </trkseg></trk></gpx>`;
}

describe('parseGpx', () => {
  it('parses a trkpt element with elevation', () => {
    const points = parseGpx(makeGpx([{ lat: 48.1, lon: 24.2, ele: 300 }]));
    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({ lat: 48.1, lon: 24.2, ele: 300 });
  });

  it('sets ele to null when elevation is absent', () => {
    const points = parseGpx(makeGpx([{ lat: 48.1, lon: 24.2 }]));
    expect(points[0].ele).toBeNull();
  });

  it('parses multiple trkpt elements', () => {
    const points = parseGpx(
      makeGpx([
        { lat: 48.1, lon: 24.2, ele: 100 },
        { lat: 48.2, lon: 24.3, ele: 200 },
        { lat: 48.3, lon: 24.4, ele: 300 },
      ]),
    );
    expect(points).toHaveLength(3);
    expect(points[1].lat).toBeCloseTo(48.2, 5);
    expect(points[2].lon).toBeCloseTo(24.4, 5);
  });

  it('handles self-closing trkpt tags', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="48.1" lon="24.2"/></trkseg></trk></gpx>`;
    const points = parseGpx(gpx);
    expect(points).toHaveLength(1);
    expect(points[0].ele).toBeNull();
  });

  it('falls back to rtept when no trkpt elements exist', () => {
    const gpx = `<gpx><rte>
      <rtept lat="48.1" lon="24.2"></rtept>
      <rtept lat="48.3" lon="24.4"></rtept>
    </rte></gpx>`;
    const points = parseGpx(gpx);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ lat: 48.1, lon: 24.2, ele: null });
  });

  it('rtept always produces ele: null even when elevation markup is present', () => {
    // The rtept fallback loop intentionally ignores elevation
    const gpx = `<gpx><rte><rtept lat="48.1" lon="24.2"><ele>500</ele></rtept></rte></gpx>`;
    const points = parseGpx(gpx);
    expect(points[0].ele).toBeNull();
  });

  it('does not fall back to rtept when trkpt elements are present', () => {
    const gpx = `<gpx>
      <trk><trkseg><trkpt lat="48.1" lon="24.2"></trkpt></trkseg></trk>
      <rte><rtept lat="50.0" lon="30.0"></rtept></rte>
    </gpx>`;
    const points = parseGpx(gpx);
    expect(points).toHaveLength(1);
    expect(points[0].lat).toBeCloseTo(48.1, 5);
  });

  it('skips trkpt elements with NaN coordinates', () => {
    const gpx = `<gpx><trk><trkseg>
      <trkpt lat="notanumber" lon="24.2"></trkpt>
      <trkpt lat="48.1" lon="24.2"></trkpt>
    </trkseg></trk></gpx>`;
    const points = parseGpx(gpx);
    expect(points).toHaveLength(1);
    expect(points[0].lat).toBeCloseTo(48.1, 5);
  });

  it('returns empty array for empty string', () => {
    expect(parseGpx('')).toHaveLength(0);
  });

  it('returns empty array for non-GPX XML', () => {
    expect(parseGpx('<root><item>foo</item></root>')).toHaveLength(0);
  });
});

describe('buildTrackWithDistances', () => {
  it('returns empty array for empty input', () => {
    expect(buildTrackWithDistances([])).toHaveLength(0);
  });

  it('assigns cumulDist=0 to the first point', () => {
    const track = buildTrackWithDistances([{ lat: 48.0, lon: 24.0, ele: null }]);
    expect(track[0].cumulDist).toBe(0);
  });

  it('preserves lat, lon, and ele on each point', () => {
    const track = buildTrackWithDistances([{ lat: 48.0, lon: 24.0, ele: 150 }]);
    expect(track[0]).toMatchObject({ lat: 48.0, lon: 24.0, ele: 150 });
  });

  it('computes cumulative distance for two points using haversine', () => {
    const track = buildTrackWithDistances([
      { lat: 0, lon: 0, ele: null },
      { lat: 1, lon: 0, ele: null },
    ]);
    expect(track[0].cumulDist).toBe(0);
    expect(track[1].cumulDist).toBeCloseTo(haversineDistance(0, 0, 1, 0), 0);
  });

  it('accumulates distances across three points', () => {
    const track = buildTrackWithDistances([
      { lat: 0, lon: 0, ele: null },
      { lat: 1, lon: 0, ele: null },
      { lat: 2, lon: 0, ele: null },
    ]);
    const d01 = haversineDistance(0, 0, 1, 0);
    const d12 = haversineDistance(1, 0, 2, 0);
    expect(track[2].cumulDist).toBeCloseTo(d01 + d12, 0);
  });

  it('handles null elevation without error', () => {
    const track = buildTrackWithDistances([
      { lat: 0, lon: 0, ele: null },
      { lat: 1, lon: 0, ele: null },
    ]);
    expect(track[0].ele).toBeNull();
    expect(track[1].ele).toBeNull();
  });
});
