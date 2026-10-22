// Human-readable report formatting. Plain text, no ANSI.

import { councilRows, toCsv, toJson } from "./export.js";
import type { PipelineOutput } from "./pipeline.js";
import type { CommuteScore, StopScore } from "./types.js";

export function fmtHour(h: number): string {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

export function scoreReport(out: PipelineOutput): string {
  const s = out.score;
  const lines: string[] = [];
  lines.push(out.plan.name ?? "commute");
  lines.push(`date ${s.date}   total exposure ${s.total}/100`);
  if (out.mildDay) lines.push("(mild day: all apparent temps under 26C)");
  if (out.warnings.length) {
    lines.push("warnings:");
    for (const w of out.warnings) lines.push("  - " + w);
  }
  lines.push("");
  lines.push("stops (worst first):");
  const stops = [...s.stops].sort((a, b) => b.exposureScore - a.exposureScore);
  for (const st of stops) lines.push(stopLine(st));
  lines.push("");
  lines.push("walking legs (exposed):");
  const exposed = s.legs.filter((l) => l.exposed);
  if (exposed.length === 0) lines.push("  (none)");
  for (const l of exposed) {
    const from = stopName(s, l.from);
    const to = stopName(s, l.to);
    lines.push(`  ${from} -> ${to}  ${l.minutes} min  score ${l.exposureScore}/100`);
  }
  return lines.join("\n");
}

export function stopLine(st: StopScore): string {
  const name = st.name.padEnd(22).slice(0, 22);
  const score = String(st.exposureScore).padStart(3, " ");
  const at = String(st.apparentTempC).padStart(5, " ");
  return `  ${name} score ${score}/100  AT ${at}C  shade ${st.shadeFraction.toFixed(2)}  risk ${st.heatRisk}`;
}

export function suggestReport(out: PipelineOutput): string {
  const s = out.suggestions;
  const lines: string[] = [];
  lines.push(out.plan.name ?? "commute");
  lines.push("");
  lines.push("cooler departure times (lower = cooler):");
  s.best.forEach((d, i) => {
    lines.push(`  ${i + 1}. depart ${fmtHour(d.hour)}  exposure ${d.score}/100  AT ${d.apparentTempC}C`);
  });
  lines.push("");
  lines.push(
    `worst: depart ${fmtHour(s.worst.hour)}  exposure ${s.worst.score}/100  AT ${s.worst.apparentTempC}C`,
  );
  if (out.waterStops.length > 0) {
    lines.push("");
    lines.push("water / shelter stops on this route:");
    for (const w of out.waterStops) {
      const kind = w.kind === "fountain" ? "fountain - drink + cool" : "shelter";
      lines.push(`  ${w.name}  (${kind})`);
    }
  }
  return lines.join("\n");
}

export function exportReport(out: PipelineOutput, format: "csv" | "json"): string {
  const rows = councilRows(out.score);
  return format === "json" ? toJson(rows) : toCsv(rows);
}

export function gtfsStopsReport(
  stops: { id: string; name: string; lat: number; lon: number }[],
): string {
  const lines: string[] = [];
  lines.push(`stops found: ${stops.length}`);
  for (const s of stops.slice(0, 20)) {
    lines.push(`  ${s.id}  ${s.name}  ${s.lat.toFixed(4)},${s.lon.toFixed(4)}`);
  }
  if (stops.length > 20) lines.push(`  ... and ${stops.length - 20} more`);
  return lines.join("\n");
}

function stopName(score: CommuteScore, id: string): string {
  const st = score.stops.find((s) => s.stopId === id);
  return st ? st.name : id;
}
