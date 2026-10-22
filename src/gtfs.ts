// GTFS stop extraction. Reads a static GTFS ZIP (or a raw stops.txt) and
// parses stops.txt into coordinates. Zero dependencies: a minimal ZIP reader
// built on node:zlib.

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import type { Stop } from "./types.js";

// ---------- minimal ZIP reader ----------

const PK_LOCAL = 0x04034b50;
const PK_CENTRAL = 0x02014b50;
const PK_EOCD = 0x06054b50;

interface ZipEntry {
  name: string;
  compression: number;
  compSize: number;
  localOffset: number;
}

function findEocd(buf: Uint8Array, dv: DataView): number {
  // EOCD is at least 22 bytes. Comment up to 65535. Search the tail.
  const minStart = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= minStart; i--) {
    if (dv.getUint32(i, true) === PK_EOCD) return i;
  }
  throw new Error("not a zip file (EOCD not found)");
}

function parseCentral(buf: Uint8Array, dv: DataView): Map<string, ZipEntry> {
  const eocd = findEocd(buf, dv);
  const count = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  const out = new Map<string, ZipEntry>();
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== PK_CENTRAL) {
      throw new Error("corrupt central directory");
    }
    const compression = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = buf
      .subarray(p + 46, p + 46 + nameLen)
      .reduce((s, b, i) => s + String.fromCharCode(b), "") as string;
    out.set(name, { name, compression, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// Decompress one entry's data given its local header offset.
function readEntryData(buf: Uint8Array, dv: DataView, e: ZipEntry): Uint8Array {
  const lo = e.localOffset;
  if (dv.getUint32(lo, true) !== PK_LOCAL) {
    throw new Error("corrupt local file header");
  }
  const nameLen = dv.getUint16(lo + 26, true);
  const extraLen = dv.getUint16(lo + 28, true);
  const dataStart = lo + 30 + nameLen + extraLen;
  const comp = buf.subarray(dataStart, dataStart + e.compSize);
  if (e.compression === 0) return new Uint8Array(comp); // stored
  if (e.compression === 8) {
    // deflate raw. node:zlib wants a Buffer or Uint8Array.
    return new Uint8Array(inflateRawSync(Buffer.from(comp)));
  }
  throw new Error("unsupported zip compression method " + e.compression);
}

// Unzip into a { name -> bytes } map. Directory entries are skipped.
export function unzip(buf: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const entries = parseCentral(buf, dv);
  const out = new Map<string, Uint8Array>();
  for (const e of entries.values()) {
    if (e.name.endsWith("/")) continue;
    out.set(e.name, readEntryData(buf, dv, e));
  }
  return out;
}

// ---------- stops.txt ----------

// Parse GTFS stops.txt (CSV). We only need stop_id, stop_name, stop_lat,
// stop_lon. Extra columns and their order are tolerated.
export function parseStopsText(text: string): Stop[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (col: string) => header.indexOf(col);
  const iId = idx("stop_id");
  const iName = idx("stop_name");
  const iLat = idx("stop_lat");
  const iLon = idx("stop_lon");
  if (iId < 0 || iLat < 0 || iLon < 0) {
    throw new Error("stops.txt missing stop_id/stop_lat/stop_lon columns");
  }
  const stops: Stop[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const id = cols[iId]?.trim();
    const lat = parseFloat(cols[iLat]);
    const lon = parseFloat(cols[iLon]);
    if (!id || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    stops.push({
      id,
      name: iName >= 0 ? (cols[iName]?.trim() ?? id) : id,
      lat,
      lon,
      gtfsStopId: id,
      kind: "transit",
    });
  }
  return stops;
}

// Extract stops from a GTFS ZIP buffer.
export function extractStopsFromZip(buf: Uint8Array): Stop[] {
  const files = unzip(buf);
  const key = files.has("stops.txt")
    ? "stops.txt"
    : [...files.keys()].find((n) => n.endsWith("stops.txt"));
  if (!key) throw new Error("stops.txt not found in GTFS feed");
  const text = new TextDecoder().decode(files.get(key)!);
  return parseStopsText(text);
}

// Load stops from a local file path or a URL. Detects ZIP vs raw text.
export async function readStopsFeed(
  source: string,
  opts: { fetchImpl?: typeof fetch; city?: string } = {},
): Promise<Stop[]> {
  const impl = opts.fetchImpl ?? fetch;
  let buf: Uint8Array;
  if (/^https?:\/\//.test(source)) {
    const res = await impl(source, {
      headers: { "user-agent": "shadestop/0.1 (github.com/fuleinist/shadestop)" },
    });
    if (!res.ok) throw new Error("feed http " + res.status);
    buf = new Uint8Array(await res.arrayBuffer());
  } else {
    buf = new Uint8Array(readFileSync(source));
  }

  // ZIP magic: 0x50 0x4B.
  const isZip = buf.length > 2 && buf[0] === 0x50 && buf[1] === 0x4b;
  let stops: Stop[];
  if (isZip) {
    stops = extractStopsFromZip(buf);
  } else {
    stops = parseStopsText(new TextDecoder().decode(buf));
  }

  if (opts.city) {
    const needle = opts.city.toLowerCase();
    stops = stops.filter((s) => s.name.toLowerCase().includes(needle));
  }
  return stops;
}
