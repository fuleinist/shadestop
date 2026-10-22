import test from "node:test";
import assert from "node:assert/strict";
import { councilRows, toCsv, toJson } from "../src/export.js";
import type { CommuteScore, StopScore } from "../src/types.js";

function stop(id: string, name: string, exposure: number, risk: string): StopScore {
  return {
    stopId: id,
    name,
    lat: -33.87,
    lon: 151.21,
    shadeFraction: 0.2,
    trees: 2,
    shelters: 1,
    fountains: 0,
    apparentTempC: 31.1,
    heatRisk: risk,
    exposureScore: exposure,
  };
}

const score: CommuteScore = {
  date: "2026-01-15",
  total: 42,
  stops: [stop("a", "Alpha", 20, "low"), stop("b", "Beta", 70, "high"), stop("c", "Gamma", 40, "medium")],
  legs: [],
};

test("councilRows: sorted worst-first", () => {
  const rows = councilRows(score);
  assert.deepEqual(
    rows.map((r) => r.stopId),
    ["b", "c", "a"],
  );
});

test("toCsv: header plus one row per stop", () => {
  const csv = toCsv(councilRows(score));
  const lines = csv.trim().split("\n");
  assert.equal(lines.length, 4);
  assert.ok(lines[0].startsWith("stopId,name,lat,lon"));
  assert.ok(lines[1].includes("Beta"));
  assert.ok(lines[1].includes("high"));
});

test("toCsv: quotes values containing commas", () => {
  const rows = councilRows({ ...score, stops: [stop("x", "Avenue, 5th", 10, "low")] });
  const csv = toCsv(rows);
  assert.ok(csv.includes('"Avenue, 5th"'));
});

test("toJson: round-trips", () => {
  const rows = councilRows(score);
  const parsed = JSON.parse(toJson(rows));
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].name, "Beta");
});
