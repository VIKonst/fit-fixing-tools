import { describe, it, expect } from 'vitest';
import {
  degreesToSemicircles,
  semicirclesToDegrees,
  toRadians,
  haversineDistance,
  lerp,
} from '../geo';

describe('degreesToSemicircles', () => {
  it('converts 0 to 0', () => {
    expect(degreesToSemicircles(0)).toBe(0);
  });

  it('converts 180 to 2^31', () => {
    expect(degreesToSemicircles(180)).toBe(2 ** 31);
  });

  it('converts -180 to -2^31', () => {
    expect(degreesToSemicircles(-180)).toBe(-(2 ** 31));
  });

  it('converts 90 to 2^30', () => {
    expect(degreesToSemicircles(90)).toBe(2 ** 30);
  });

  it('applies Math.round (1 degree = 11930464.711… → rounds to 11930465)', () => {
    expect(degreesToSemicircles(1)).toBe(11930465);
  });
});

describe('semicirclesToDegrees', () => {
  it('converts 0 to 0', () => {
    expect(semicirclesToDegrees(0)).toBe(0);
  });

  it('converts 2^31 to 180', () => {
    expect(semicirclesToDegrees(2 ** 31)).toBe(180);
  });

  it('converts -2^31 to -180', () => {
    expect(semicirclesToDegrees(-(2 ** 31))).toBe(-180);
  });

  it('round-trips with degreesToSemicircles within floating-point precision', () => {
    const deg = 48.5;
    expect(semicirclesToDegrees(degreesToSemicircles(deg))).toBeCloseTo(deg, 5);
  });
});

describe('toRadians', () => {
  it('converts 0 to 0', () => {
    expect(toRadians(0)).toBe(0);
  });

  it('converts 180 to π', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
  });

  it('converts 90 to π/2', () => {
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
  });

  it('handles negative values', () => {
    expect(toRadians(-90)).toBeCloseTo(-Math.PI / 2, 10);
  });
});

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    expect(haversineDistance(48.0, 24.0, 48.0, 24.0)).toBe(0);
  });

  it('is symmetric', () => {
    const d1 = haversineDistance(48.0, 24.0, 50.0, 26.0);
    const d2 = haversineDistance(50.0, 26.0, 48.0, 24.0);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('returns ~111 195 m for 1 degree of latitude at the equator', () => {
    // Earth radius 6 371 000 m, 1° lat at equator ≈ 111 194.9 m
    expect(haversineDistance(0, 0, 1, 0)).toBeCloseTo(111194.9, 0);
  });

  it('computes distance between two known cities within 1%', () => {
    // Kyiv (50.4501, 30.5234) → Kharkiv (49.9935, 36.2304) ≈ 410 km
    const dist = haversineDistance(50.4501, 30.5234, 49.9935, 36.2304);
    expect(dist).toBeGreaterThan(405_000);
    expect(dist).toBeLessThan(415_000);
  });
});

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(5, 10, 0)).toBe(5);
  });

  it('returns b when t=1', () => {
    expect(lerp(5, 10, 1)).toBe(10);
  });

  it('returns midpoint when t=0.5', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('interpolates at arbitrary t', () => {
    expect(lerp(0, 100, 0.3)).toBeCloseTo(30, 10);
  });

  it('extrapolates below t=0', () => {
    expect(lerp(0, 10, -0.5)).toBe(-5);
  });

  it('extrapolates above t=1', () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
  });
});
