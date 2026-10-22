import test from "node:test";
import assert from "node:assert/strict";
import {
  vaporPressureHpa,
  apparentTempC,
  heatBase,
} from "../src/heat.js";

test("vaporPressureHpa: 30C at 50% RH", () => {
  const e = vaporPressureHpa(30, 50);
  assert.ok(Math.abs(e - 21.14) < 0.15, `e=${e}`);
});

test("vaporPressureHpa: RH clamps to [0,100]", () => {
  assert.equal(vaporPressureHpa(30, 150), vaporPressureHpa(30, 100));
  assert.equal(vaporPressureHpa(30, -5), 0);
});

test("apparentTempC: BOM formula sanity points", () => {
  // 30C/50%RH, 3 m/s wind -> ~30.9C
  assert.ok(Math.abs(apparentTempC(30, 50, 3) - 30.9) < 0.05);
  // 25C/50%RH -> ~24.1C
  assert.ok(Math.abs(apparentTempC(25, 50, 3) - 24.1) < 0.05);
  // 35C/80%RH -> ~43.7C (wet heat exceeds dry-bulb)
  assert.ok(Math.abs(apparentTempC(35, 80, 3) - 43.7) < 0.05);
});

test("apparentTempC: dry air cools the apparent temperature", () => {
  const dry = apparentTempC(30, 10, 3);
  const wet = apparentTempC(30, 80, 3);
  assert.ok(dry < 30, `dry=${dry}`);
  assert.ok(wet > 30, `wet=${wet}`);
  assert.ok(dry < wet);
});

test("apparentTempC: wind has a mild cooling effect", () => {
  const calm = apparentTempC(30, 50, 1);
  const windy = apparentTempC(30, 50, 8);
  assert.ok(windy < calm, `windy=${windy} calm=${calm}`);
});

test("heatBase: 0 at 20C, 1 at 40C+, clamped", () => {
  assert.equal(heatBase(20), 0);
  assert.equal(heatBase(40), 1);
  assert.equal(heatBase(30), 0.5);
  assert.equal(heatBase(10), 0);
  assert.equal(heatBase(55), 1);
});
