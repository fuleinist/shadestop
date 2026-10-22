// Open-Meteo forecast access + on-disk cache.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ForecastDay, ForecastHour } from "./types.js";

export const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoHourly {
  time: string[];
  temperature_2m?: number[];
  relative_humidity_2m?: number[];
  shortwave_radiation?: number[];
}

interface OpenMeteoDaily {
  time?: string[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
}

interface OpenMeteoResponse {
  hourly?: OpenMeteoHourly;
  daily?: OpenMeteoDaily;
  timezone: string;
}

function buildUrl(lat: number, lon: number): string {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "temperature_2m,relative_humidity_2m,shortwave_radiation",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "1",
  });
  return OPEN_METEO_BASE + "?" + p.toString();
}

// Parse the local hour (0..23) from an Open-Meteo time value.
export function hourFromOmeTime(t: string): number {
  // Format "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD HH:MM".
  const m = t.match(/T(\d{2}):/);
  if (m) return parseInt(m[1], 10);
  const m2 = t.match(/ (\d{2}):/);
  if (m2) return parseInt(m2[1], 10);
  return 0;
}

// Convert a raw Open-Meteo payload into our ForecastDay.
export function parseOpenMeteo(json: OpenMeteoResponse): ForecastDay {
  const hours: ForecastHour[] = [];
  const h = json.hourly;
  if (h && h.time) {
    for (let i = 0; i < h.time.length; i++) {
      hours.push({
        hour: hourFromOmeTime(h.time[i]),
        tempC: h.temperature_2m?.[i] ?? 0,
        rhPct: h.relative_humidity_2m?.[i] ?? 50,
        solarRadiationWm2: h.shortwave_radiation?.[i] ?? 0,
      });
    }
  }
  const date = h?.time?.[0]?.slice(0, 10) ?? json.daily?.time?.[0] ?? "today";
  return {
    date,
    tempMaxC: json.daily?.temperature_2m_max?.[0] ?? 0,
    tempMinC: json.daily?.temperature_2m_min?.[0] ?? 0,
    hours,
  };
}

// Fetch + cache. `fetch` is injectable for tests.
export async function fetchForecast(
  lat: number,
  lon: number,
  opts: { cacheDir?: string; fetchImpl?: typeof fetch; date?: string } = {},
): Promise<{ day: ForecastDay; fromCache: boolean }> {
  const key = `${lat},${lon}`;
  const cacheDir = opts.cacheDir;
  const cachePath = cacheDir ? join(cacheDir, `forecast_${key}.json`) : "";

  if (cachePath && existsSync(cachePath)) {
    try {
      const raw = readFileSync(cachePath, "utf8");
      const day = JSON.parse(raw) as ForecastDay;
      return { day, fromCache: true };
    } catch {
      /* fall through to network */
    }
  }

  const impl = opts.fetchImpl ?? fetch;
  const url = buildUrl(lat, lon);
  const res = await impl(url, {
    headers: { "user-agent": "shadestop/0.1 (github.com/fuleinist/shadestop)" },
  });
  if (!res.ok) throw new Error("open-meteo http " + res.status);
  const json = (await res.json()) as OpenMeteoResponse;
  const day = parseOpenMeteo(json);

  if (cachePath) {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(day));
  }
  return { day, fromCache: false };
}
