import test from "node:test";
import assert from "node:assert/strict";
import {
  apparentAt,
  heatRisk,
  stopExposureScore,
  scoreCommute,
  maxDailyApparent,
} from "../src/score.js";
import { apparentTempC } from "../src/heat.js";
import { heatBase } from "../src/heat.js";
import { hourPenalty } from "../src/sun.js";
import { round, clamp } from "../src/math.js";
import type { CommutePlan, ForecastDay, ShadeInfo } from "../src/types.js";

const SYD_SUMMER = { lat: -33.87, lon: 151.21, dayOfYear: 355 };
const NOON_UTC = 1.92; // Sydney solar noon, summer (12 - 151.21/15)

const day: ForecastDay = {
  date: "2026-01-15",
  tempMaxC: 32.4,
  tempMinC: 15,
  utcOffsetSeconds: 39600,
  hours: [
    { hour: 5, tempC: 17, rhPct: 80, solarRadiationWm2: 0 },
    { hour: 12, tempC: 32, rhPct: 33, solarRadiationWm2: 830 },
    { hour: 13, tempC: 32, rhPct: 33, solarRadiationWm2: 830 },
  ],
};

function shade(fraction: number, shelter = false, fountain = false): ShadeInfo {
  return {
    assets: { trees: 0, shelters: 0, fountains: 0 },
    shadeFraction: fraction,
    shelterWithin50m: shelter,
    fountainWithin30m: fountain,
  };
}

// Compose the expected value from the pinned primitives.
function expectedScore(at: number, sh: ShadeInfo, hourUtc: number): number {
  const base = heatBase(at);
  const cut = 0.35 * sh.shadeFraction + (sh.shelterWithin50m ? 0.05 : 0) + (sh.fountainWithin30m ? 0.03 : 0);
  const penalty = hourPenalty(SYD_SUMMER.lat, SYD_SUMMER.lon, SYD_SUMMER.dayOfYear, hourUtc);
  return round(100 * clamp(base * clamp(1 - cut, 0, 1) * penalty, 0, 1));
}

test("apparentAt: 32C/33%RH matches the BOM formula", () => {
  assert.ok(Math.abs(apparentAt(day, 13) - apparentTempC(32, 33, 3)) < 1e-9);
});

test("stopExposureScore: matches composed model at summer noon", () => {
  const at = apparentTempC(32, 33, 3);
  const noShade = stopExposureScore({
    apparentC: at,
    shade: shade(0),
    lat: SYD_SUMMER.lat,
    lon: SYD_SUMMER.lon,
    dayOfYear: SYD_SUMMER.dayOfYear,
    hourUtc: NOON_UTC,
  });
  assert.equal(noShade, expectedScore(at, shade(0), NOON_UTC));
  assert.ok(noShade >= 40 && noShade <= 60, `noShade=${noShade}`);

  // Shaded + shelter + fountain cuts the score by ~40%.
  const wellShaded = stopExposureScore({
    apparentC: at,
    shade: shade(0.6, true, true),
    lat: SYD_SUMMER.lat,
    lon: SYD_SUMMER.lon,
    dayOfYear: SYD_SUMMER.dayOfYear,
    hourUtc: NOON_UTC,
  });
  assert.equal(wellShaded, expectedScore(at, shade(0.6, true, true), NOON_UTC));
  assert.ok(wellShaded < noShade, `shaded=${wellShaded} vs open=${noShade}`);
});

test("stopExposureScore: cold day scores zero", () => {
  const s = stopExposureScore({
    apparentC: 12,
    shade: shade(0),
    lat: SYD_SUMMER.lat,
    lon: SYD_SUMMER.lon,
    dayOfYear: SYD_SUMMER.dayOfYear,
    hourUtc: NOON_UTC,
  });
  assert.equal(s, 0);
});

test("heatRisk: pinned cases per SPEC", () => {
  assert.equal(heatRisk(33, 0.1), "high"); // hot + low shade
  assert.equal(heatRisk(33, 0.5), "medium"); // hot but shaded
  assert.equal(heatRisk(30, 0.1), "medium"); // moderate heat, low shade
  assert.equal(heatRisk(24, 0.2), "low");
  assert.equal(heatRisk(24, 0.05), "medium"); // low shade alone is medium
});

test("maxDailyApparent: peaks midday", () => {
  const m = maxDailyApparent(day);
  assert.ok(m > apparentTempC(17, 80, 3));
  assert.ok(Math.abs(m - apparentTempC(32, 33, 3)) < 1e-9);
});

const plan: CommutePlan = {
  origin: { id: "o", name: "Origin", lat: -33.8, lon: 151.2 },
  destination: { id: "d", name: "Dest", lat: -33.9, lon: 151.3 },
  stops: [{ id: "s1", name: "Mid", lat: -33.85, lon: 151.25 }],
  legs: [
    { from: "o", "to": "s1", mode: "train", minutes: 45 },
    { from: "s1", "to": "d", mode: "walk", minutes: 10 },
  ],
};

test("scoreCommute: vehicle legs excluded, walking legs scored", () => {
  const shadeMap = new Map<string, ShadeInfo>([
    ["o", shade(0.4)],
    ["s1", shade(0.5)],
    ["d", shade(0.1)],
  ]);
  const sun = { lat: -33.87, lon: 151.21, dayOfYear: 355, utcOffsetHours: 11 };
  const score = scoreCommute(plan, day, shadeMap, sun, 12);
  assert.equal(score.total >= 0 && score.total <= 100, true);
  const trainLeg = score.legs.find((l) => l.mode === "train");
  assert.equal(trainLeg?.exposed, false);
  assert.equal(trainLeg?.exposureScore, 0);
  const walkLeg = score.legs.find((l) => l.mode === "walk");
  assert.equal(walkLeg?.exposed, true);
  assert.ok(walkLeg!.exposureScore > 0);
  // Destination has the least shade, so it should carry the highest stop score.
  const dest = score.stops.find((s) => s.stopId === "d")!;
  const mid = score.stops.find((s) => s.stopId === "s1")!;
  assert.ok(dest.exposureScore >= mid.exposureScore);
});
