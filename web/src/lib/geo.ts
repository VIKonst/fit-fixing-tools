export function degreesToSemicircles(deg: number): number {
  return Math.round(deg * (2 ** 31 / 180));
}

export function semicirclesToDegrees(semi: number): number {
  return semi * (180 / 2 ** 31);
}

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
