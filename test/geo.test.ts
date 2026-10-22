import test from "node:test";
import assert from "node:assert/strict";
import { haversineM, METERS_PER_DEG_LAT } from "../src/geo.js";

test("haversineM: same point is zero", () => {
  assert.equal(haversineM({ lat: -33.87, lon: 151.21 }, { lat: -33.87, lon: 151.21 }), 0);
});

test("haversineM: 1 degree of longitude at the equator", () => {
  const d = haversineM({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
  assert.ok(d > 111100 && d < 111300, `d=${d}`);
});

test("haversineM: Sydney pair ~0.002 deg apart", () => {
  const a = { lat: -33.87, lon: 151.21 };
  const b = { lat: -33.868, lon: 151.212 };
  const d = haversineM(a, b);
  assert.ok(d > 270 && d < 310, `d=${d}`);
});

test("METERS_PER_DEG_LAT is ~111 km", () => {
  assert.ok(METERS_PER_DEG_LAT > 110000 && METERS_PER_DEG_LAT < 112000);
});
