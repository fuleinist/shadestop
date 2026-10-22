import test from "node:test";
import assert from "node:assert/strict";
import { allStops, validatePlan, arrivalTimes } from "../src/commute.js";
import type { CommutePlan } from "../src/types.js";

const plan: CommutePlan = {
  name: "t",
  origin: { id: "o", name: "Origin", lat: -33.8, lon: 151.2 },
  destination: { id: "d", name: "Dest", lat: -33.9, lon: 151.3 },
  stops: [
    { id: "s1", name: "Mid1", lat: -33.85, lon: 151.25 },
    { id: "s2", name: "Mid2", lat: -33.87, lon: 151.28 },
  ],
  legs: [
    { from: "o", "to": "s1", mode: "train", minutes: 45 },
    { from: "s1", "to": "s2", mode: "walk", minutes: 8 },
    { from: "s2", "to": "d", mode: "walk", minutes: 10 },
  ],
};

test("allStops: origin, stops, destination in leg order, deduped", () => {
  const ids = allStops(plan).map((s) => s.id);
  assert.deepEqual(ids, ["o", "s1", "s2", "d"]);
  // Dedup when a stop repeats as origin and destination.
  const p2: CommutePlan = {
    ...plan,
    origin: { id: "s1", name: "Mid1", lat: 0, lon: 0 },
  };
  const ids2 = allStops(p2).map((s) => s.id);
  assert.equal(ids2.filter((id) => id === "s1").length, 1);
});

test("validatePlan: valid plan has no errors", () => {
  assert.deepEqual(validatePlan(plan), []);
});

test("validatePlan: catches unknown leg refs and zero minutes", () => {
  const bad: CommutePlan = {
    ...plan,
    legs: [
      { from: "o", to: "ghost", mode: "walk", minutes: 5 },
      { from: "o", to: "d", mode: "walk", minutes: 0 },
    ],
  };
  const errors = validatePlan(bad);
  assert.ok(errors.some((e) => e.includes("ghost")));
  assert.ok(errors.some((e) => e.includes("> 0 min")));
});

test("arrivalTimes: cumulative minutes from departure", () => {
  const at = arrivalTimes(plan, 8);
  assert.deepEqual(at.get("o"), { hour: 8, minutes: 0 });
  assert.deepEqual(at.get("s1"), { hour: 8, minutes: 45 });
  assert.deepEqual(at.get("s2"), { hour: 8, minutes: 53 });
  assert.deepEqual(at.get("d"), { hour: 9, minutes: 3 });
});
