// Cooler departure suggestions and water-stop hints.

import { allStops } from "./commute.js";
import { apparentAt, scoreCommute } from "./score.js";
import type {
  CommutePlan,
  DepartureSuggestion,
  ForecastDay,
  ShadeInfo,
} from "./types.js";

export interface SuggestionResult {
  best: DepartureSuggestion[];
  worst: DepartureSuggestion;
  all: DepartureSuggestion[];
}

// Score every departure hour and rank. Lower total = cooler commute.
export function suggestDepartures(
  plan: CommutePlan,
  day: ForecastDay,
  shadeByStop: Map<string, ShadeInfo>,
  sun: { lat: number; lon: number; dayOfYear: number; utcOffsetHours: number },
  startHour = 5,
  endHour = 21,
): SuggestionResult {
  const all: DepartureSuggestion[] = [];
  for (let h = startHour; h <= endHour; h++) {
    const scored = scoreCommute(plan, day, shadeByStop, sun, h);
    all.push({
      hour: h,
      score: scored.total,
      apparentTempC: Math.round(apparentAt(day, h) * 10) / 10,
    });
  }
  all.sort((a, b) => a.score - b.score);
  const best = all.slice(0, 3);
  const worst = all[all.length - 1];
  return { best, worst, all };
}

// Fountains and shelters on the plan's stops. Fountains first: drinking
// water plus cooling mist beats shade alone on hot days.
export function waterStopHints(
  plan: CommutePlan,
  shadeByStop: Map<string, ShadeInfo>,
): { stopId: string; name: string; kind: "fountain" | "shelter" }[] {
  const stops = allStops(plan);
  const out: { stopId: string; name: string; kind: "fountain" | "shelter" }[] = [];
  for (const s of stops) {
    const shade = shadeByStop.get(s.id);
    if (!shade) continue;
    if (shade.fountainWithin30m) out.push({ stopId: s.id, name: s.name, kind: "fountain" });
    if (shade.shelterWithin50m) out.push({ stopId: s.id, name: s.name, kind: "shelter" });
  }
  out.sort((a, b) => (a.kind === "fountain" ? 0 : 1) - (b.kind === "fountain" ? 0 : 1));
  return out;
}

// True when the hottest apparent hour stays under 26C.
export function isMildDay(day: ForecastDay): boolean {
  if (day.hours.length === 0) return true;
  let m = -Infinity;
  for (const h of day.hours) m = Math.max(m, apparentAt(day, h.hour));
  return m < 26;
}
