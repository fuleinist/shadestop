#!/usr/bin/env -S npx tsx
import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { analyzeCommute, loadPlan } from "./pipeline.js";
import { readStopsFeed } from "./gtfs.js";
import {
  exportReport,
  gtfsStopsReport,
  scoreReport,
  suggestReport,
} from "./report.js";
import { runDemo } from "./demo.js";



function usage(): string {
  return [
    "shadestop — heat-smart commuting advisor",
    "",
    "usage: shadestop <command> [options]",
    "",
    "commands:",
    "  score      score a commute plan for heat exposure",
    "  suggest    suggest cooler departure times + water stops",
    "  export     council report export (csv or json)",
    "  gtfs-stops extract stop coordinates from a GTFS feed",
    "  demo       offline demo with bundled fixtures",
    "",
    "common options:",
    "  --commute <plan.json>   commute plan file",
    "  --cache-dir <dir>       forecast cache directory",
    "  --json                  machine-readable output",
    "  --format csv|json       export format (export command)",
    "  --feed <url-or-path>    GTFS feed (gtfs-stops command)",
    "  --out <file>            write output to a file",
    "  --city <name>           filter stops by city substring",
  ].join("\n");
}

interface Cli {
  command: string;
  options: Record<string, string>;
}

function parseCli(): Cli {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const rest = argv.slice(1);
  // Declaring option types makes parseArgs associate `--flag value` pairs.
  // Without an options map, every --flag is treated as a boolean and the
  // value leaks into positionals.
  const { values } = parseArgs({
    options: {
      commute: { type: "string" },
      "cache-dir": { type: "string" },
      format: { type: "string" },
      feed: { type: "string" },
      out: { type: "string" },
      city: { type: "string" },
      json: { type: "boolean" },
    },
    allowPositionals: true,
    strict: true,
    args: rest,
  });
  return {
    command: command ?? "help",
    options: values as unknown as Record<string, string>,
  };
}

function need(opts: Record<string, string>, key: string, flag: string): string {
  const v = opts[key];
  if (!v) {
    console.error(`missing required option ${flag}`);
    console.log(usage());
    process.exit(2);
  }
  return v;
}

async function runScore(opts: Record<string, string>): Promise<void> {
  const planPath = need(opts, "commute", "--commute <plan.json>");
  const plan = loadPlan(planPath);
  const out = await analyzeCommute(plan, { cacheDir: opts["cache-dir"] });
  if (opts.json) console.log(JSON.stringify(out.score, null, 2));
  else console.log(scoreReport(out));
}

async function runSuggest(opts: Record<string, string>): Promise<void> {
  const planPath = need(opts, "commute", "--commute <plan.json>");
  const plan = loadPlan(planPath);
  const out = await analyzeCommute(plan, { cacheDir: opts["cache-dir"] });
  const text = opts.json ? JSON.stringify(out.suggestions, null, 2) : suggestReport(out);
  const body = opts.out ? text : text;
  if (opts.out) writeFileSync(opts.out, text);
  else console.log(body);
}

async function runExport(opts: Record<string, string>): Promise<void> {
  const planPath = need(opts, "commute", "--commute <plan.json>");
  const plan = loadPlan(planPath);
  const out = await analyzeCommute(plan, { cacheDir: opts["cache-dir"] });
  const format = (opts.format as "csv" | "json") ?? "csv";
  const text = exportReport(out, format);
  if (opts.out) {
    writeFileSync(opts.out, text);
    console.log(`wrote ${opts.out}`);
  } else {
    console.log(text);
  }
}

async function runGtfsStops(opts: Record<string, string>): Promise<void> {
  const feed = need(opts, "feed", "--feed <url-or-path>");
  const stops = await readStopsFeed(feed, { city: opts.city });
  const text = opts.json ? JSON.stringify(stops, null, 2) : gtfsStopsReport(stops);
  if (opts.out) {
    writeFileSync(opts.out, text);
    console.log(`wrote ${opts.out} (${stops.length} stops)`);
  } else {
    console.log(text);
  }
}

async function main(): Promise<void> {
  const { command, options } = parseCli();
  switch (command) {
    case "score":
      await runScore(options);
      break;
    case "suggest":
      await runSuggest(options);
      break;
    case "export":
      await runExport(options);
      break;
    case "gtfs-stops":
      await runGtfsStops(options);
      break;
    case "demo":
      await runDemo();
      break;
    case "help":
    case undefined:
      console.log(usage());
      break;
    default:
      console.error(`unknown command: ${command}\n`);
      console.log(usage());
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error("error:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
