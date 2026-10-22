// Overpass API access: build query, fetch, parse into shade assets.

import { METERS_PER_DEG_LAT, type GeoPoint } from "./geo.js";

export type ShadeKind = "tree" | "shelter" | "fountain";

export interface ShadeAsset extends GeoPoint {
  kind: ShadeKind;
}

// Raw Overpass element as returned by the API.
interface OverpassElement {
  type: string;
  id: number | string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// Public Overpass instances, tried in order. A descriptive User-Agent is
// required (nginx rejects the default Node UA with 406).
//   de    : full current data, but gets 429/502 under load.
//   osm.ch: fast and reachable, but serves a partial/stale tree dataset,
//           so treat its asset counts as best-effort.
// kumi.systems and mail.ru are unreachable from this network (they hang).
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

export const DEFAULT_USER_AGENT =
  "shadestop/0.1 (research; github.com/fuleinist/shadestop)";

// Build the Overpass QL for trees, shelters, and fountains in a box.
// Radius is approximate because 1 deg of longitude varies with latitude.
export function shadeQuery(lat: number, lon: number, radiusM = 100): string {
  const dLat = radiusM / METERS_PER_DEG_LAT;
  const dLon = radiusM / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  const w = lat - dLat;
  const s = lat + dLat;
  const e = lon - dLon;
  const n = lon + dLon;
  return [
    "[out:json][timeout:25];",
    "( nwr[\"natural\"=\"tree\"](" + w + "," + e + "," + s + "," + n + ");",
    "  nwr[\"public_transport\"=\"shelter\"](" + w + "," + e + "," + s + "," + n + ");",
    "  nwr[\"drinking_water\"=\"yes\"][\"shower\"!=\"yes\"](" +
      w + "," + e + "," + s + "," + n + ");",
    "); out center 300;",
  ].join("\n");
}

function classify(el: OverpassElement): ShadeKind | null {
  const t = el.tags ?? {};
  if (t.natural === "tree") return "tree";
  if (t.public_transport === "shelter") return "shelter";
  if (t.drinking_water === "yes" && t.shower !== "yes") return "fountain";
  return null;
}

function pointOf(el: OverpassElement): GeoPoint | null {
  if (el.lat != null && el.lon != null) {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center) return el.center;
  return null;
}

// Parse a raw Overpass response into shade asset points.
// Ways/relations need a center; nodes have coordinates directly.
export function parseShadeAssets(json: OverpassResponse): ShadeAsset[] {
  const out: ShadeAsset[] = [];
  for (const el of json.elements) {
    const kind = classify(el);
    if (!kind) continue;
    const p = pointOf(el);
    if (!p) continue;
    out.push({ kind, lat: p.lat, lon: p.lon });
  }
  return out;
}

// Fetch and parse shade assets. `fetch` is injectable for tests.
// Rotates through public endpoints until one answers.
export async function fetchShadeAssets(
  lat: number,
  lon: number,
  opts: {
    radiusM?: number;
    endpoints?: string[];
    endpoint?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    retryMs?: number;
    attempts?: number;
  } = {},
): Promise<ShadeAsset[]> {
  const impl = opts.fetchImpl ?? fetch;
  const query = shadeQuery(lat, lon, opts.radiusM ?? 100);
  const endpoints =
    opts.endpoint ? [opts.endpoint] : (opts.endpoints ?? OVERPASS_ENDPOINTS);

  let lastError: unknown;
  // Fail fast by default: one attempt per endpoint, then rotate. Keeps a
  // multi-stop commute quick when the primary is saturated. Pass
  // attempts>1 + retryMs for same-endpoint backoff on flaky links.
  const attemptsPerEndpoint = opts.attempts ?? 1;
  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= attemptsPerEndpoint; attempt++) {
      try {
        return await fetchShadeAssetsFrom(endpoint, query, impl, {
          timeoutMs: opts.timeoutMs ?? 12000,
        });
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        // Bad queries (4xx except 429) fail the same everywhere. Stop
        // rotating on those. 429 and 5xx keep rotating to next endpoint.
        if (
          msg.startsWith("overpass http 4") &&
          !msg.startsWith("overpass http 429")
        ) {
          throw err;
        }
        if (attempt < attemptsPerEndpoint) {
          await sleep((opts.retryMs ?? 1500) * 2 ** (attempt - 1));
        }
      }
    }
  }
  throw new Error(
    "all overpass endpoints failed: " +
      (lastError instanceof Error ? lastError.message : String(lastError)),
  );
}

async function fetchShadeAssetsFrom(
  endpoint: string,
  query: string,
  impl: typeof fetch,
  opts: { timeoutMs: number },
): Promise<ShadeAsset[]> {
  const body = new URLSearchParams({ data: query });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await impl(endpoint, {
      method: "POST",
      body,
      signal: ctrl.signal,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": DEFAULT_USER_AGENT,
      },
    });
    if (!res.ok) throw new Error("overpass http " + res.status);
    const json = (await res.json()) as OverpassResponse;
    return parseShadeAssets(json);
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
