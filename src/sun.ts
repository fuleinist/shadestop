// Solar position approximation for commute scoring.
// Accuracy target: within a few degrees, enough for exposure ranking.
// Documented approximations: no daylight-saving shifts, no equation of time.

import { clamp } from "./math.js";

const RAD = Math.PI / 180;

// Day of year, 1..365/366.
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86400000) + 1;
}

// Approximate solar declination in degrees.
// 0 at the equinoxes (N=81, N=266), +23.45 near the June solstice.
export function solarDeclinationDeg(dayOfYear: number): number {
  return 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
}

// Approximate solar noon in UTC hours for a longitude.
// 12 - lon/15. East of Greenwich means noon comes earlier in UTC.
// DST is not modelled. Use local-civil conventions when calling.
export function solarNoonUtc(lonDeg: number): number {
  return 12 - lonDeg / 15;
}

// Solar elevation in degrees above the horizon. Negative when below it.
export function solarElevationDeg(
  latDeg: number,
  lonDeg: number,
  dayOfYear: number,
  hourUtc: number,
): number {
  const dec = solarDeclinationDeg(dayOfYear) * RAD;
  const lat = latDeg * RAD;
  // Solar hour angle: 0 at local solar noon, 15 deg per hour.
  const hourAngle = (15 * (hourUtc + lonDeg / 15 - 12)) * RAD;
  const sinEl =
    Math.sin(lat) * Math.sin(dec) +
    Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  return Math.asin(clamp(sinEl, -1, 1)) / RAD;
}

// 0 when the sun is down; scales up toward noon.
// This is the "direct sun exposure" factor used by the hourly penalty.
export function sunExposureFactor(
  latDeg: number,
  lonDeg: number,
  dayOfYear: number,
  hourUtc: number,
): number {
  const el = solarElevationDeg(latDeg, lonDeg, dayOfYear, hourUtc);
  if (el <= 0) return 0;
  // Map elevation 0..90 to 0..1 with a mild curve. Low sun still adds
  // some exposure, but midday sun dominates.
  const x = el / 90;
  return clamp(x, 0, 1);
}

// Hourly penalty for heat exposure: 0.6 in early/late sun, 1.0 at midday.
// Uses the sun exposure factor so it peaks near solar noon.
export function hourPenalty(latDeg: number, lonDeg: number, dayOfYear: number, hourUtc: number): number {
  return 0.6 + 0.4 * sunExposureFactor(latDeg, lonDeg, dayOfYear, hourUtc);
}

// Daylight length in hours for the given date and place.
export function daylightHours(latDeg: number, lonDeg: number, dayOfYear: number): number {
  const dec = solarDeclinationDeg(dayOfYear) * RAD;
  const lat = latDeg * RAD;
  const cosH = -Math.tan(lat) * Math.tan(dec);
  if (cosH <= -1) return 24; // midnight sun
  if (cosH >= 1) return 0; // polar night
  const H = Math.acos(cosH) / RAD; // degrees
  return (2 * H) / 15;
}
