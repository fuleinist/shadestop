// Offline demo: runs the whole pipeline on bundled fixtures, no network.

import { runDemoData } from "./demo-data.js";
import { exportReport, scoreReport, suggestReport } from "./report.js";

export async function runDemo(): Promise<void> {
  const out = await runDemoData();

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
