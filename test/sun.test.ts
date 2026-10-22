import test from "node:test";
import assert from "node:assert/strict";
import {
  dayOfYear,
  solarDeclinationDeg,
  solarNoonUtc,
  solarElevationDeg,
  sunExposureFactor,
  hourPenalty,
  daylightHours,
} from "../src/sun.js";

const SYDNEY = { lat: -33.87, lon: 151.21 };

test("dayOfYear: known dates", () => {
  assert.equal(dayOfYear(new Date(Date.UTC(2026, 5, 21))), 172); // Jun 21
  assert.equal(dayOfYear(new Date(Date.UTC(2026, 11, 21))), 355); // Dec 21
  assert.equal(dayOfYear(new Date(Date.UTC(2026, 0, 1))), 1);
});

test("solarDeclinationDeg: solstices and equinox", () => {
  assert.ok(Math.abs(solarDeclinationDeg(172) - 23.45) < 0.1);
  assert.ok(Math.abs(solarDeclinationDeg(355) + 23.45) < 0.1);
  assert.ok(Math.abs(solarDeclinationDeg(81)) < 0.5);
});

test("solarNoonUtc: Sydney comes before 12 UTC", () => {
  const noon = solarNoonUtc(SYDNEY.lon);
  assert.ok(noon > 1.5 && noon < 2.5);
});

test("solarElevationDeg: Sydney June solstice noon is low (~33 deg)", () => {
  const noonUtc = solarNoonUtc(SYDNEY.lon);
  const el = solarElevationDeg(SYDNEY.lat, SYDNEY.lon, 172, noonUtc);
  assert.ok(el > 30 && el < 35, `el=${el}`);
});

test("solarElevationDeg: Sydney December solstice noon is high (~79 deg)", () => {
  const noonUtc = solarNoonUtc(SYDNEY.lon);
  const el = solarElevationDeg(SYDNEY.lat, SYDNEY.lon, 355, noonUtc);
  assert.ok(el > 77 && el < 82, `el=${el}`);
});

test("solarElevationDeg: equator at equinox noon is ~90", () => {
  const el = solarElevationDeg(0, 0, 81, 12);
  assert.ok(Math.abs(el - 90) < 0.5, `el=${el}`);
});

test("solarElevationDeg: below horizon at local midnight in winter", () => {
  const el = solarElevationDeg(SYDNEY.lat, SYDNEY.lon, 172, 14); // 00:00 AEST
  assert.ok(el < 0, `el=${el}`);
});

test("sunExposureFactor: 0 at night, high at summer noon", () => {
  assert.equal(sunExposureFactor(SYDNEY.lat, SYDNEY.lon, 172, 14), 0);
  const noonUtc = solarNoonUtc(SYDNEY.lon);
  const summer = sunExposureFactor(SYDNEY.lat, SYDNEY.lon, 355, noonUtc);
  assert.ok(summer > 0.8 && summer <= 1, `summer=${summer}`);
});

test("hourPenalty: 0.6 when sun down, near 1.0 at summer noon", () => {
  const noonUtc = solarNoonUtc(SYDNEY.lon);
  assert.equal(hourPenalty(SYDNEY.lat, SYDNEY.lon, 172, 14), 0.6);
  const peak = hourPenalty(SYDNEY.lat, SYDNEY.lon, 355, noonUtc);
  // Sydney summer-noon sun elevation ~79 deg -> factor ~0.88 -> ~0.95.
  assert.ok(peak > 0.9 && peak <= 1.0, `peak=${peak}`);
  // Equator at equinox noon reaches the full 1.0 penalty.
  assert.ok(Math.abs(hourPenalty(0, 0, 81, 12) - 1.0) < 0.01);
});

test("daylightHours: Sydney winter ~9.7 h, summer ~14.2 h", () => {
  const winter = daylightHours(SYDNEY.lat, SYDNEY.lon, 172);
  const summer = daylightHours(SYDNEY.lat, SYDNEY.lon, 355);
  assert.ok(winter > 9.4 && winter < 10.1, `winter=${winter}`);
  assert.ok(summer > 13.9 && summer < 14.6, `summer=${summer}`);
});

test("daylightHours: polar midnight sun and night", () => {
  assert.equal(daylightHours(80, 0, 172), 24);
  assert.equal(daylightHours(80, 0, 355), 0);
});
