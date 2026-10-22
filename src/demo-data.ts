// Offline demo data source shared by the CLI demo and the web sample.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allStops } from "./commute.js";
import { emptyShade } from "./score.js";
import { analyzeCommute } from "./pipeline.js";
import type { CommutePlan, ForecastDay, ShadeInfo } from "./types.js";

function fixturePath(name: string): string {
  const here = new URL(".", import.meta.url);
  return fileURLToPath(new URL("../fixtures/" + name, here));
}

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(fixturePath(name), "utf8")) as T;
}

function stopIdFor(plan: CommutePlan, lat: number, lon: number): string | undefined {
  for (const s of allStops(plan)) {
    if (Math.abs(s.lat - lat) < 1e-6 && Math.abs(s.lon - lon) < 1e-6) return s.id;
  }
  return undefined;
}

// Run the full pipeline on the bundled fixtures. No network.
export async function runDemoData() {
  const plan = loadFixture<CommutePlan>("demo-commute.json");
  const day = loadFixture<ForecastDay>("demo-forecast.json");
  const shade = loadFixture<Record<string, ShadeInfo>>("demo-shade.json");

  const forecastImpl = async () => ({ day, fromCache: true });
  const shadeImpl = async (lat: number, lon: number) => {
    const id = stopIdFor(plan, lat, lon);
    return (id && shade[id]) || emptyShade();
  };

  return analyzeCommute(plan, { forecastImpl, shadeImpl });
}
