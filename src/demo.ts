// Offline demo: runs the whole pipeline on bundled fixtures, no network.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allStops } from "./commute.js";
import { emptyShade } from "./score.js";
import { analyzeCommute } from "./pipeline.js";
import { exportReport, scoreReport, suggestReport } from "./report.js";
import type { CommutePlan, ForecastDay, ShadeInfo } from "./types.js";

function fixturePath(name: string): string {
  // Resolve fixtures relative to the repo root (two levels up from src).
  const here = new URL(".", import.meta.url);
  return fileURLToPath(new URL("../fixtures/" + name, here));
}

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(fixturePath(name), "utf8")) as T;
}

// Map a (lat, lon) back to the demo stop id it belongs to.
function stopIdFor(plan: CommutePlan, lat: number, lon: number): string | undefined {
  for (const s of allStops(plan)) {
    if (Math.abs(s.lat - lat) < 1e-6 && Math.abs(s.lon - lon) < 1e-6) return s.id;
  }
  return undefined;
}

export async function runDemo(): Promise<void> {
  const plan = loadFixture<CommutePlan>("demo-commute.json");
  const day = loadFixture<ForecastDay>("demo-forecast.json");
  const shade = loadFixture<Record<string, ShadeInfo>>("demo-shade.json");

  const forecastImpl = async () => ({ day, fromCache: true });
  const shadeImpl = async (lat: number, lon: number) => {
    const id = stopIdFor(plan, lat, lon);
    return (id && shade[id]) || emptyShade();
  };

  const out = await analyzeCommute(plan, { forecastImpl, shadeImpl });

  console.log("=== shadestop demo (offline fixtures) ===\n");
  console.log(scoreReport(out));
  console.log("");
  console.log(suggestReport(out));
  console.log("");
  console.log("=== council export (csv) ===");
  console.log(exportReport(out, "csv"));

  if (out.warnings.length > 0) {
    console.log("\nwarnings:");
    for (const w of out.warnings) console.log("  - " + w);
  }
}
