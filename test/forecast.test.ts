import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import {
  hourFromOmeTime,
  parseOpenMeteo,
  fetchForecast,
} from "../src/forecast.js";

const omeFixture = {
  hourly: {
    time: ["2026-10-23T00:00", "2026-10-23T12:00", "2026-10-23T13:00"],
    temperature_2m: [16, 31, 32],
    relative_humidity_2m: [70, 40, 45],
    shortwave_radiation: [0, 400, 420],
  },
  daily: {
    time: ["2026-10-23"],
    temperature_2m_max: [32.4],
    temperature_2m_min: [15.2],
  },
  timezone: "Australia/Sydney",
};

test("hourFromOmeTime: ISO and space-separated forms", () => {
  assert.equal(hourFromOmeTime("2026-10-23T07:00"), 7);
  assert.equal(hourFromOmeTime("2026-10-23 07:00"), 7);
  assert.equal(hourFromOmeTime("garbage"), 0);
});

test("parseOpenMeteo: maps hourly series to ForecastHour", () => {
  const day = parseOpenMeteo(omeFixture);
  assert.equal(day.date, "2026-10-23");
  assert.equal(day.tempMaxC, 32.4);
  assert.equal(day.tempMinC, 15.2);
  assert.equal(day.hours.length, 3);
  assert.deepEqual(day.hours[1], {
    hour: 12,
    tempC: 31,
    rhPct: 40,
    solarRadiationWm2: 400,
  });
});

test("parseOpenMeteo: tolerates missing series", () => {
  const day = parseOpenMeteo({ timezone: "UTC" });
  assert.equal(day.hours.length, 0);
  assert.equal(day.tempMaxC, 0);
});

test("fetchForecast: uses network, writes cache, serves cache next call", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "shadestop-test-"));

  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls++;
    return new Response(JSON.stringify(omeFixture), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const first = await fetchForecast(-33.9, 151.2, {
    cacheDir: dir,
    fetchImpl: fakeFetch,
  });
  assert.equal(first.fromCache, false);
  assert.equal(calls, 1);

  const second = await fetchForecast(-33.9, 151.2, {
    cacheDir: dir,
    fetchImpl: fakeFetch,
  });
  assert.equal(second.fromCache, true);
  assert.equal(calls, 1);
  assert.deepEqual(second.day.hours[2], {
    hour: 13,
    tempC: 32,
    rhPct: 45,
    solarRadiationWm2: 420,
  });
});

test("fetchForecast: surfaces HTTP errors", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response("nope", { status: 500 });
  await assert.rejects(
    () => fetchForecast(-33.9, 151.2, { fetchImpl: fakeFetch }),
    /open-meteo http 500/,
  );
});
