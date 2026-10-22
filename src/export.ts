// Council report export: per-stop shade and heat table.

import type { CommuteScore, StopScore } from "./types.js";

export interface CouncilRow {
  stopId: string;
  name: string;
  lat: number;
  lon: number;
  trees: number;
  shelters: number;
  fountains: number;
  shadeFraction: number;
  apparentTempC: number;
  heatRisk: string;
  exposureScore: number;
}

// Flatten the scored commute into council rows, worst first.
export function councilRows(score: CommuteScore): CouncilRow[] {
  const rows: CouncilRow[] = score.stops.map((s: StopScore) => ({
    stopId: s.stopId,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    trees: s.trees,
    shelters: s.shelters,
    fountains: s.fountains,
    shadeFraction: s.shadeFraction,
    apparentTempC: s.apparentTempC,
    heatRisk: s.heatRisk,
    exposureScore: s.exposureScore,
  }));
  rows.sort((a, b) => b.exposureScore - a.exposureScore);
  return rows;
}

const HEADERS: (keyof CouncilRow)[] = [
  "stopId",
  "name",
  "lat",
  "lon",
  "trees",
  "shelters",
  "fountains",
  "shadeFraction",
  "apparentTempC",
  "heatRisk",
  "exposureScore",
];

export function toCsv(rows: CouncilRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(HEADERS.map((h) => csvCell(r[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toJson(rows: CouncilRow[]): string {
  return JSON.stringify(rows, null, 2);
}
