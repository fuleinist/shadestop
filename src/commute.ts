// Commute plan helpers: ordering, validation, arrival times.

import type { CommutePlan, Stop } from "./types.js";

// Origin + intermediate stops + destination, deduped by id, in leg order.
export function allStops(plan: CommutePlan): Stop[] {
  const seen = new Set<string>();
  const out: Stop[] = [];
  const push = (s: Stop) => {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    out.push(s);
  };
  push(plan.origin);
  for (const s of plan.stops) push(s);
  push(plan.destination);
  return out;
}

// Check that every leg references known stops and has positive duration.
export function validatePlan(plan: CommutePlan): string[] {
  const errors: string[] = [];
  const ids = new Set(allStops(plan).map((s) => s.id));
  if (!plan.origin.id || !plan.destination.id) {
    errors.push("origin and destination need an id");
  }
  for (const s of plan.stops) {
    if (!s.id) errors.push("every stop needs an id");
  }
  for (const leg of plan.legs) {
    if (!ids.has(leg.from)) errors.push(`leg from unknown stop '${leg.from}'`);
    if (!ids.has(leg.to)) errors.push(`leg to unknown stop '${leg.to}'`);
    if (leg.minutes <= 0) errors.push(`leg ${leg.from}->${leg.to} must be > 0 min`);
  }
  return errors;
}

// Map of stop id -> arrival { hour, minutesIntoHour } given a departure hour.
// Cumulative along the declared leg order.
export function arrivalTimes(
  plan: CommutePlan,
  departureHour: number,
): Map<string, { hour: number; minutes: number }> {
  const out = new Map<string, { hour: number; minutes: number }>();
  let total = departureHour * 60;
  out.set(plan.origin.id, split(total));
  for (const leg of plan.legs) {
    total += leg.minutes;
    out.set(leg.to, split(total));
  }
  return out;
}

function split(totalMinutes: number): { hour: number; minutes: number } {
  const hour = Math.floor(totalMinutes / 60) % 24;
  return { hour, minutes: totalMinutes % 60 };
}

// The time (hour 0..23) when a walking leg is in progress: departure +
// elapsed + half the leg duration.
export function legMidTime(plan: CommutePlan, departureHour: number, legIndex: number): number {
  let elapsed = 0;
  for (let i = 0; i < legIndex; i++) elapsed += plan.legs[i].minutes;
  const leg = plan.legs[legIndex];
  return Math.floor((departureHour * 60 + elapsed + leg.minutes / 2) / 60) % 24;
}
