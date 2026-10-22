// Small numeric helpers shared across the model.
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function round(v: number, places = 0): number {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

// Weighted mean. Weights must line up with values by index.
export function weightedMean(values: number[], weights: number[]): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < values.length; i++) {
    num += values[i] * weights[i];
    den += weights[i];
  }
  return den === 0 ? 0 : num / den;
}
