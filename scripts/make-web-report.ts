// Write a sample web/report.json from the offline demo fixtures.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runDemoData } from "../src/demo-data.js";

const { score, suggestions, day } = await runDemoData();
const report = {
  date: day.date,
  total: score.total,
  stops: score.stops,
  legs: score.legs,
  best: suggestions.best,
  worst: suggestions.worst,
};
const out = fileURLToPath(new URL("../web/report.json", import.meta.url));
writeFileSync(out, JSON.stringify(report, null, 2));
console.log("wrote", out);
