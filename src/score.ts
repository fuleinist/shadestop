// Exposure scoring per SPEC.md.

import { clamp, round, weightedMean } from "./math.js";
import { apparentTempC, heatBase } from "./heat.js";
import { hourPenalty } from "./sun.js";
import { arrivalTimes, allStops, legMidTime } from "./commute.js";
import type {
  CommutePlan,
  CommuteScore,
  ForecastDay,
  HeatRisk,
  LegScore,
  ShadeInfo,
  Stop,
  StopScore,
} from "./types.js";

// One forecast hour, looked up by local hour. Falls back to the closest
// available hour when the table is incomplete.
export function hourOf(day: ForecastDay, hour: number): { tempC: number; rhPct: number } {
  const h = day.hours.find((x) => x.hour === hour);
  if (h) return { tempC: h.tempC, rhPct: h.rhPct };
  const fallback = day.hours[0] ?? { hour: 0, tempC: 20, rhPct: 50, solarRadiationWm2: 0 };
  return { tempC: fallback.tempC, rhPct: fallback.rhPct };
}

// Apparent temperature for a forecast hour.
export function apparentAt(day: ForecastDay, hour: number): number {
  const { tempC, rhPct } = hourOf(day, hour);
  return apparentTempC(tempC, rhPct);
}

// Max apparent temperature across the day (council heat-risk input).
export function maxDailyApparent(day: ForecastDay): number {
  if (day.hours.length === 0) return day.tempMaxC;
  let m = -Infinity;
  for (const h of day.hours) {
    m = Math.max(m, apparentTempC(h.tempC, h.rhPct));
  }
  return m;
}

// Council-view risk per SPEC.md.
export function heatRisk(maxApparentC: number, shadeFraction: number): HeatRisk {
  if (maxApparentC >= 32 && shadeFraction < 0.2) return "high";
  if (maxApparentC >= 28 || shadeFraction < 0.1) return "medium";
  return "low";
}

// The 0..100 exposure score for one stop at one time.
export function stopExposureScore(opts: {
  apparentC: number;
  shade: ShadeInfo;
  lat: number;
  lon: number;
  dayOfYear: number;
  hourUtc: number;
}): number {
  const base = heatBase(opts.apparentC);
  const shadeCut = 0.35 * opts.shade.shadeFraction;
  const shelterCut = opts.shade.shelterWithin50m ? 0.05 : 0;
  const fountainCut = opts.shade.fountainWithin30m ? 0.03 : 0;
  const penalty = hourPenalty(opts.lat, opts.lon, opts.dayOfYear, opts.hourUtc);
  const v = base * clamp(1 - shadeCut - shelterCut - fountainCut, 0, 1) * penalty;
  return round(100 * clamp(v, 0, 1));
}

// Score a whole commute departing at `departureHour`.
// Stops are weighted by a 5-minute default dwell; walking legs by duration.
export function scoreCommute(
  plan: CommutePlan,
  day: ForecastDay,
  shadeByStop: Map<string, ShadeInfo>,
  sun: { lat: number; lon: number; dayOfYear: number; utcOffsetHours: number },
  departureHour: number,
): CommuteScore {
  const stops = allStops(plan);
  const arrivals = arrivalTimes(plan, departureHour);

  const stopScores: StopScore[] = [];
  for (const s of stops) {
    const at = arrivals.get(s.id) ?? { hour: departureHour, minutes: 0 };
    const shade = shadeByStop.get(s.id) ?? emptyShade();
    const apparent = apparentAt(day, at.hour);
    const hourUtc = at.hour - sun.utcOffsetHours;
    const score = stopExposureScore({
      apparentC: apparent,
      shade,
      lat: s.lat,
      lon: s.lon,
      dayOfYear: sun.dayOfYear,
      hourUtc,
    });
    stopScores.push({
      stopId: s.id,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      shadeFraction: shade.shadeFraction,
      trees: shade.assets.trees,
      shelters: shade.assets.shelters,
      fountains: shade.assets.fountains,
      apparentTempC: round(apparent, 1),
      heatRisk: heatRisk(maxDailyApparent(day), shade.shadeFraction),
      exposureScore: score,
    });
  }

  const legScores: LegScore[] = [];
  plan.legs.forEach((leg, i) => {
    const exposed = leg.mode === "walk" || leg.mode === "ride";
    const midHour = legMidTime(plan, departureHour, i);
    if (!exposed) {
      legScores.push({
        legIndex: i,
        from: leg.from,
        to: leg.to,
        mode: leg.mode,
        minutes: leg.minutes,
        exposed: false,
        exposureScore: 0,
      });
      return;
    }
    // Use the destination stop's shade for the walking leg.
    const shade = shadeByStop.get(leg.to) ?? emptyShade();
    const apparent = apparentAt(day, midHour);
    const hourUtc = midHour - sun.utcOffsetHours;
    const score = stopExposureScore({
      apparentC: apparent,
      shade,
      lat: sun.lat,
      lon: sun.lon,
      dayOfYear: sun.dayOfYear,
      hourUtc,
    });
    legScores.push({
      legIndex: i,
      from: leg.from,
      to: leg.to,
      mode: leg.mode,
      minutes: leg.minutes,
      exposed: true,
      exposureScore: score,
    });
  });

  const values = [...stopScores.map((s) => s.exposureScore), ...legScores.filter((l) => l.exposed).map((l) => l.exposureScore)];
  const weights = [
    ...stopScores.map(() => 5),
    ...legScores.filter((l) => l.exposed).map((l) => l.minutes),
  ];
  const total = values.length ? round(weightedMean(values, weights)) : 0;

  return {
    date: day.date,
    total,
    stops: stopScores,
    legs: legScores,
  };
}

export function emptyShade(): ShadeInfo {
  return {
    assets: { trees: 0, shelters: 0, fountains: 0 },
    shadeFraction: 0,
    shelterWithin50m: false,
    fountainWithin30m: false,
  };
}

export function stopById(plan: CommutePlan, id: string): Stop | undefined {
  return allStops(plan).find((s) => s.id === id);
}
