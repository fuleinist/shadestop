# shadestop — Specification

## What it is

shadestop is a heat-smart commuting tool. It scores transit stops and walking legs
for shade and heat exposure. Then it suggests cooler departure times and routes.

It uses free public data: Open-Meteo forecasts, OpenStreetMap shade assets, and
GTFS stop feeds. No API keys. No paid services.

## Problem

Urban heat is a top city issue. Commuters face hours of sun and heat on transit.
Current heat tools focus on walking route selection. No tool scores transit
stops and departure times. Councils lack stop-level exposure data for shade
and water upgrades.

## Inputs

- Commute plan: origin, destination, list of stops and walking legs.
- Stop list: name, latitude, longitude, optional GTFS stop_id.
- Forecast: Open-Meteo daily temperature, humidity, and solar radiation.
- Shade assets: OpenStreetMap Overpass query for trees, shelters, fountains
  within 100 m of each stop.
- GTFS: static stop files from transit feeds. Local CSV or ZIP feeds work.

## Features

1. **Exposure scoring**
   - Each stop and walking leg gets a score from 0 to 100.
   - 0 is cool and shaded. 100 is hot and fully exposed.
   - The model blends apparent temperature, forecast solar radiation,
     shade fraction, and shelter and fountain presence.

2. **Departure suggestion**
   - Score every departure hour from 05:00 to 21:00.
   - Walking legs are weighted by exposure time. Vehicle time is not.
   - Output the top 3 cooler departure times.
   - Output the worst time to avoid.

3. **Water stop hints**
   - Find fountains and shelters near the route.
   - Suggest them for mid-commute rest on hot days.

4. **Council report export**
   - Per-stop table with shade counts, shade fraction, and heat risk.
   - Shade upgrade priority flag.
   - CSV and JSON output.

5. **GTFS stop extraction**
   - Download a GTFS feed ZIP or read a local file.
   - Parse stops.txt. Export stop coordinates as JSON or CSV.

6. **Demo mode**
   - Run fully offline with bundled fixtures.
   - Verify the full pipeline without a network.

## CLI

```
shadestop score --commute plan.json [--date YYYY-MM-DD] [--cache-dir dir]
shadestop suggest --commute plan.json [--date YYYY-MM-DD]
shadestop export --commute plan.json [--format csv|json]
shadestop gtfs-stops --feed <url-or-path> [--out stops.json] [--city "Sydney"]
shadestop demo
```

All commands print human-readable output. Machine output uses `--json`.

## Model

### Apparent temperature

Use the BOM Apparent Temperature formula with Magnus vapor pressure:

```
e  = (RH/100) * 6.105 * exp(17.27*T / (T + 237.7))   # hPa
AT = T + 0.33*e - 0.70*wind - 4.00                    # wind default 3 m/s
```

Sanity checks: 30C/50%RH -> ~30.9C, 25C/50%RH -> ~24.1C, 35C/80%RH -> ~43.7C.

### Heat base

```
heatBase = clamp((AT - 20) / 20, 0, 1)   # 20C -> 0, 40C+ -> 1
```

### Shade fraction

From Overpass assets within 100 m of a point:

```
canopy   = min(0.60, 0.08 * treeCount)
shelter  = min(0.20, 0.10 * shelterCount)
fountain = min(0.10, 0.05 * fountainCount)
shadeFraction = min(1.0, canopy + shelter + fountain)
```

### Exposure score

```
base       = clamp((AT - 20) / 20, 0, 1)      # 20C -> 0, 40C+ -> 1
shadeCut   = 0.35 * shadeFraction
shelterCut = 0.05 if shelter within 50 m, else 0
fountainCut= 0.03 if fountain within 30 m, else 0
hourPenalty= 0.6 + 0.4 * middayFactor(time)   # worst at midday sun
score      = round(100 * clamp(base * (1 - shadeCut - shelterCut - fountainCut)
                                * hourPenalty, 0, 1))
```

Commute total = weighted mean of segment scores. Weights are segment
durations in minutes.

### Heat risk per stop (council view)

```
risk = high if (maxDailyAT >= 32 and shadeFraction < 0.20)
       medium if maxDailyAT >= 28 or shadeFraction < 0.10
       else low
priority = risk
```

## Acceptance criteria

- `node --test` passes. All core modules have unit tests.
- `demo` runs offline with fixtures and prints a full report.
- Live dogfood: score a real Sydney commute with live Open-Meteo and
  Overpass data. Suggest departure times. Export the council report.
- Zero runtime dependencies. Node built-ins only.
- TS strict mode. CLI entry via tsx or node after compile.

## Out of scope

- Live map rendering (a static table view ships instead).
- Door-to-door transit routing. Stop-level scoring only.
- Historical analysis. Forecasts and current data only.
