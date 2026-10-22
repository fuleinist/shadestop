// Shared analysis pipeline: load plan, fetch forecast + shade, score, suggest.
// CLI commands format their own output on top of this.

import { readFileSync } from "node:fs";
import { allStops, validatePlan } from "./commute.js";
import { fetchForecast } from "./forecast.js";
import { fetchShadeAssets } from "./overpass.js";
import { shadeInfoFromAssets } from "./shade.js";
import { dayOfYear } from "./sun.js";
import { emptyShade, scoreCommute } from "./score.js";
import { isMildDay, suggestDepartures, waterStopHints } from "./suggest.js";
import type { CommutePlan, ForecastDay, ShadeInfo } from "./types.js";

export interface PipelineOutput {
  plan: CommutePlan;
  day: ForecastDay;
  shadeByStop: Map<string, ShadeInfo>;
  sun: { lat: number; lon: number; dayOfYear: number; utcOffsetHours: number };
  score: ReturnType<typeof scoreCommute>;
  suggestions: ReturnType<typeof suggestDepartures>;
  waterStops: ReturnType<typeof waterStopHints>;
  mildDay: boolean;
  warnings: string[];
}

export function loadPlan(path: string): CommutePlan {
  const raw = readFileSync(path, "utf8");
  const plan = JSON.parse(raw) as CommutePlan;
  const errors = validatePlan(plan);
  if (errors.length > 0) {
    throw new Error("invalid commute plan:\n  - " + errors.join("\n  - "));
  }
  return plan;
}

// Fallback UTC offset when Open-Meteo omits it. Rough (no DST, no
// equation of time). Documented approximation.
export function guessUtcOffsetHours(lon: number): number {
  return Math.round(lon / 15);
}

// Run the full pipeline. `forecastImpl` and `shadeImpl` are injectable so
// the demo and tests need no network.
export async function analyzeCommute(
  plan: CommutePlan,
  opts: {
    cacheDir?: string;
    forecastImpl?: (
      lat: number,
      lon: number,
      o: { cacheDir?: string },
    ) => Promise<{ day: ForecastDay; fromCache: boolean }>;
    shadeImpl?: (lat: number, lon: number) => Promise<ShadeInfo>;
  } = {},
): Promise<PipelineOutput> {
  const warnings: string[] = [];
  const origin = plan.origin;

  const forecastImpl =
    opts.forecastImpl ??
    ((lat, lon, o) => fetchForecast(lat, lon, { cacheDir: o.cacheDir }));
  const shadeImpl =
    opts.shadeImpl ??
    (async (lat, lon) => {
      const assets = await fetchShadeAssets(lat, lon);
      return shadeInfoFromAssets(assets, { lat, lon });
    });

  const { day } = await forecastImpl(origin.lat, origin.lon, {
    cacheDir: opts.cacheDir,
  });

  // Fetch shade for every stop in parallel. Any failure degrades that stop
  // to zero shade with one consolidated warning rather than aborting the
  // whole analysis.
  const stops = allStops(plan);
  const shadeResults = await Promise.all(
    stops.map(async (s) => {
      try {
        return {
          id: s.id,
          shade: await shadeImpl(s.lat, s.lon),
          error: null,
        };
      } catch (err) {
        return { id: s.id, shade: emptyShade(), error: err };
      }
    }),
  );
  const shadeByStop = new Map<string, ShadeInfo>();
  let firstShadeError: unknown = null;
  for (const r of shadeResults) {
    shadeByStop.set(r.id, r.shade);
    if (r.error && firstShadeError === null) firstShadeError = r.error;
  }
  if (firstShadeError !== null) {
    warnings.push(
      "shade data unavailable (" +
        (firstShadeError instanceof Error
          ? firstShadeError.message
          : String(firstShadeError)) +
        "); scoring some stops with zero shade",
    );
  }

  const sun = {
    lat: origin.lat,
    lon: origin.lon,
    dayOfYear: dayOfYear(new Date()),
    utcOffsetHours:
      day.utcOffsetSeconds != null
        ? day.utcOffsetSeconds / 3600
        : guessUtcOffsetHours(origin.lon),
  };

  const score = scoreCommute(plan, day, shadeByStop, sun, 8);
  const suggestions = suggestDepartures(plan, day, shadeByStop, sun);
  const waterStops = waterStopHints(plan, shadeByStop);
  const mildDay = isMildDay(day);

  return {
    plan,
    day,
    shadeByStop,
    sun,
    score,
    suggestions,
    waterStops,
    mildDay,
    warnings,
  };
}
