// Geodesic distance helper.

export interface GeoPoint {
  lat: number;
  lon: number;
}

// Great-circle distance in metres.
export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Rough 1 degree of latitude in metres. Good enough for query boxes.
export const METERS_PER_DEG_LAT = 111320;
