# shadestop — Build Plan

Spec-first GSD. Each cycle ends with a commit. Max 10 cycles.

## Cycle map

| # | Goal | Deliverable |
|---|------|-------------|
| 1 | Scaffold + spec | SPEC.md, PLAN.md, package.json, tsconfig, src layout, git init |
| 2 | Sun + heat model | `sun.ts` (solar position, midday factor), `heat.ts` (BOM AT), tests |
| 3 | Shade + Overpass | `overpass.ts` (query build, fetch, zip-free), `shade.ts` scoring, tests |
| 4 | Forecast + GTFS | `forecast.ts` (Open-Meteo + cache), `gtfs.ts` (zip reader, stops.txt), tests |
| 5 | Score + suggest + export | `commute.ts`, `score.ts`, `suggest.ts`, `export.ts`, CLI wiring, tests |
| 6 | Demo + dogfood + docs | fixtures, `demo.ts`, web table page, README, live Sydney run, polish |

## Conventions

- TypeScript strict. Node built-ins only. Zero runtime deps.
- Dev deps: typescript, tsx, @types/node.
- CLI: `src/index.ts` with `node:util` `parseArgs`.
- Cache: `--cache-dir` default `.shadestop-cache/` next to cwd.
- Network code returns typed results. Every fetch has an offline fallback
  path for demo and tests.
- Commit message per cycle: `cycle N: <summary>`.

## Verification gates

- After each cycle: `npx tsx --test test/*.test.ts` green.
- Cycle 6: live dogfood from G:\dev\projects\shadestop against Sydney.
- Done when: all acceptance criteria in SPEC.md hold.
