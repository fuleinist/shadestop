// Heat model. BOM apparent temperature + a 0..1 heat base.

import { clamp } from "./math.js";

// Magnus vapor pressure in hPa from dry-bulb C and relative humidity %.
export function vaporPressureHpa(tC: number, rhPct: number): number {
  const rh = clamp(rhPct, 0, 100) / 100;
  const e = 6.105 * Math.exp((17.27 * tC) / (tC + 237.7));
  return rh * e;
}

// BOM Apparent Temperature:
//   AT = Ta + 0.33*e - 0.70*ws - 4.00
// Ta: dry-bulb C, e: vapor pressure hPa, ws: 10 m wind m/s (default 3).
export function apparentTempC(tC: number, rhPct: number, windMs = 3): number {
  const e = vaporPressureHpa(tC, rhPct);
  return tC + 0.33 * e - 0.7 * windMs - 4.0;
}

// 0 at 20C apparent, 1 at 40C+, linear between. Below 20C -> 0.
export function heatBase(apparentTemp: number): number {
  return clamp((apparentTemp - 20) / 20, 0, 1);
}
