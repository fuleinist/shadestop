import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPlan, analyzeCommute } from "../src/pipeline.js";
import type { CommutePlan, ForecastDay, ShadeInfo } from "../src/types.js";

const plan: CommutePlan = {
  origin: { id: "o", name: "Origin", lat: -33.8, lon: 151.2 },
  destination: { id: "d", name: "Dest", lat: -33.9, lon: 151.3 },
  stops: [],
  legs: [{ from: "o", "to": "d", mode: "walk", minutes: 30 }],
};

const day: ForecastDay = {
  date: "2026-01-15",
  tempMaxC: 31,
  tempMinC: 15,
  utcOffsetSeconds: 39600,
  hours: [
    { hour: 8, tempC: 25, rhPct: 50, solarRadiationWm2: 0 },
    { hour: 13, tempC: 31, rhPct: 33, solarRadiationWm2: 0 },
  ],
};

const okShade: ShadeInfo = {
  assets: { trees: 4, shelters: 1, fountains: 0 },
  shadeFraction: 0.42,
  shelterWithin50m: true,
  fountainWithin30m: false,
};

test("loadPlan: rejects invalid plans with all errors listed", () => {
  const bad: CommutePlan = {
    origin: { id: "o", name: "O", lat: 0, lon: 0 },
    destination: { id: "d", name: "D", lat: 0, lon: 0 },
    stops: [],
    legs: [{ from: "o", to: "nope", mode: "walk", minutes: 5 }],
  };
  const dir = mkdtempSync(join(tmpdir(), "shadestop-plan-"));
  const p = join(dir, "plan.json");
  writeFileSync(p, JSON.stringify(bad));
  assert.throws(() => loadPlan(p), /nope/);
});

test("loadPlan: accepts a valid plan from disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "shadestop-plan-"));
  const p = join(dir, "plan.json");
  writeFileSync(p, JSON.stringify(plan));
  const loaded = loadPlan(p);
  assert.equal(loaded.legs.length, 1);
});

test("analyzeCommute: degrades gracefully when shade fetching fails", async () => {
  const failingShade = async () => {
    throw new Error("all overpass endpoints failed");
  };
  const out = await analyzeCommute(plan, {
    forecastImpl: async () => ({ day, fromCache: true }),
    shadeImpl: failingShade,
  });
  assert.ok(out.warnings.some((w) => w.includes("shade data unavailable")));
  assert.ok(out.score.total >= 0 && out.score.total <= 100);
  // Every stop fell back to zero shade.
  for (const s of out.score.stops) assert.equal(s.trees, 0);
});

test("analyzeCommute: uses injected shade and forecast", async () => {
  const out = await analyzeCommute(plan, {
    forecastImpl: async () => ({ day, fromCache: true }),
    shadeImpl: async () => okShade,
  });
  assert.equal(out.warnings.length, 0);
  for (const s of out.score.stops) {
    assert.equal(s.trees, 4);
    assert.equal(s.shadeFraction, 0.42);
  }
});
