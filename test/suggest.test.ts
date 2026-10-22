import test from "node:test";
import assert from "node:assert/strict";
import { isMildDay, suggestDepartures, waterStopHints } from "../src/suggest.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { CommutePlan, ForecastDay, ShadeInfo } from "../src/types.js";

function fixture(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
}

const plan = JSON.parse(readFileSync(fixture("demo-commute.json"), "utf8")) as CommutePlan;
const day = JSON.parse(readFileSync(fixture("demo-forecast.json"), "utf8")) as ForecastDay;
const shade = JSON.parse(readFileSync(fixture("demo-shade.json"), "utf8")) as Record<string, ShadeInfo>;

const sun = { lat: -33.87, lon: 151.21, dayOfYear: 355, utcOffsetHours: 11 };

test("suggestDepartures: early morning wins on a hot summer day", () => {
  const res = suggestDepartures(plan, day, new Map(Object.entries(shade)), sun, 5, 21);
  // 5:00-6:00 is ~16-17C (zero heat base); midday is ~31C.
  assert.ok(res.best[0].hour <= 7, `best=${res.best[0].hour}`);
  assert.ok(res.worst.hour >= 12, `worst=${res.worst.hour}`);
  assert.ok(res.worst.score > res.best[0].score);
  assert.equal(res.all.length, 17); // hours 5..21
  // Scores are non-increasing in the sorted list.
  for (let i = 1; i < res.all.length; i++) {
    assert.ok(res.all[i].score >= res.all[i - 1].score - 1e-9);
  }
});

test("waterStopHints: fountains rank before shelters", () => {
  const hints = waterStopHints(plan, new Map(Object.entries(shade)));
  // s1 has both a fountain (30 m) and a shelter (50 m). s2 has a shelter.
  assert.equal(hints[0].kind, "fountain");
  assert.equal(hints[0].stopId, "s1");
  const names = hints.map((h) => `${h.stopId}:${h.kind}`).sort();
  assert.deepEqual(names, ["s1:fountain", "s1:shelter", "s2:shelter"]);
});

test("isMildDay: hot demo day is not mild; a cool day is", () => {
  assert.equal(isMildDay(day), false);
  const cool: ForecastDay = {
    ...day,
    hours: [{ hour: 13, tempC: 20, rhPct: 50, solarRadiationWm2: 0 }],
  };
  assert.equal(isMildDay(cool), true);
});
