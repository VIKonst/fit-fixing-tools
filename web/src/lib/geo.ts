// FIT stores coordinates as 32-bit signed integers in "semicircles".
// The full circle (360°) maps to 2^32 units, so one hemisphere (180°) = 2^31.
// This gives ~1 cm resolution globally without floating-point rounding drift.
export function degreesToSemicircles(deg: number): number {
  return Math.round(deg * (2 ** 31 / 180));
}

export function semicirclesToDegrees(semi: number): number {
  return semi * (180 / 2 ** 31);
}

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Computes great-circle distance between two lat/lon points in meters.
// Uses the haversine formula, which stays numerically stable for both very
// short segments (millimeters) and long arcs, unlike the simpler spherical
// law of cosines which loses precision at small angles due to floating-point
// cancellation. R = 6,371,000 m is the mean Earth radius (WGS-84 approximation).
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  // a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
  // This is the squared half-chord length on a unit sphere.
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  // c = 2·atan2(√a, √(1−a)) converts half-chord to central angle in radians.
  // atan2 is used instead of asin to avoid domain errors when a ≈ 1.
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Linear interpolation: returns the value t% of the way from a to b.
// t=0 → a, t=1 → b, t=0.5 → midpoint. Used to find the GPS coordinate
// at an arbitrary distance between two known GPX waypoints.
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
