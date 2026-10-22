#!/usr/bin/env -S npx tsx
import { parseArgs } from "node:util";

// CLI entry. Commands are wired up in cycle 5.
// Until then this prints usage so the tool is runnable from cycle 1.

const COMMANDS = ["score", "suggest", "export", "gtfs-stops", "demo", "help"];

function usage(): string {
  return [
    "shadestop — heat-smart commuting advisor",
    "",
    "usage: shadestop <command> [options]",
    "",
    "commands:",
    "  score       score a commute plan for heat exposure",
    "  suggest     suggest cooler departure times",
    "  export      council report export (csv or json)",
    "  gtfs-stops  extract stop coordinates from a GTFS feed",
    "  demo        offline demo with bundled fixtures",
    "",
    "options: see SPEC.md",
  ].join("\n");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [command, ...rest] = argv;
  const values = parseArgs({
    allowPositionals: true,
    strict: false,
    args: rest,
  }).values;

  if (!command || command === "help" || command === "-h" || command === "--help") {
    console.log(usage());
    return;
  }
  if (!COMMANDS.includes(command)) {
    console.error(`unknown command: ${command}\n`);
    console.log(usage());
    process.exitCode = 1;
    return;
  }
  // Wired up in cycle 5.
  console.log(`command '${command}' is not implemented yet (stub, cycle 1)`);
  console.log(`parsed values: ${JSON.stringify(values)}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
