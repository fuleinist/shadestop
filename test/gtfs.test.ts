import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import {
  unzip,
  parseStopsText,
  extractStopsFromZip,
  readStopsFeed,
} from "../src/gtfs.js";

// ---------- in-memory ZIP builder (for tests only) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeZip(
  files: { name: string; data: Buffer; stored?: boolean }[],
): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const nameB = Buffer.from(f.name, "utf8");
    const stored = !!f.stored;
    const dataB = stored ? f.data : Buffer.from(deflateRawSync(f.data));
    const crc = crc32(f.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataB.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(nameB.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(Buffer.concat([local, nameB, dataB]));

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(stored ? 0 : 8, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(dataB.length, 20);
    cd.writeUInt32LE(f.data.length, 24);
    cd.writeUInt16LE(nameB.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([cd, nameB]));

    offset += local.length + nameB.length + dataB.length;
  }

  const cdStart = offset;
  const cdBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);
  return new Uint8Array(Buffer.concat([...locals, cdBuf, eocd]));
}

// ---------- tests ----------

const STOPS = [
  "stop_id,stop_code,stop_name,stop_desc,stop_lat,stop_lon,zone_id",
  "501,C1,Test Street,main road,-33.9,151.2,Z1",
  "502,C2,Hot Avenue,side street,-33.91,151.21,Z2",
].join("\n");

test("unzip: round-trips deflated and stored entries", () => {
  const stopsBuf = Buffer.from(STOPS, "utf8");
  const agencyBuf = Buffer.from("agency_id,agency_name\n1,Test Transit\n");
  const zip = makeZip([
    { name: "stops.txt", data: stopsBuf },
    { name: "agency.txt", data: agencyBuf, stored: true },
  ]);
  const files = unzip(zip);
  assert.equal(files.get("stops.txt")!.length, stopsBuf.length);
  assert.equal(new TextDecoder().decode(files.get("stops.txt")!), STOPS);
  assert.equal(
    new TextDecoder().decode(files.get("agency.txt")!),
    "agency_id,agency_name\n1,Test Transit\n",
  );
});

test("unzip: rejects non-zip input", () => {
  assert.throws(() => unzip(new Uint8Array(Buffer.from("not a zip at all"))));
});

test("parseStopsText: extracts needed columns, tolerates extras", () => {
  const stops = parseStopsText(STOPS);
  assert.equal(stops.length, 2);
  assert.equal(stops[0].id, "501");
  assert.equal(stops[0].name, "Test Street");
  assert.equal(stops[0].lat, -33.9);
  assert.equal(stops[0].lon, 151.2);
  assert.equal(stops[1].name, "Hot Avenue");
});

test("parseStopsText: skips malformed rows, falls back to id for name", () => {
  const text = [
    "stop_id,stop_lat,stop_lon",
    "9,50.1,8.4",
    "bad-row,-,--",
    "10,50.2,8.5",
  ].join("\n");
  const stops = parseStopsText(text);
  assert.equal(stops.length, 2);
  assert.equal(stops[0].name, "9"); // no stop_name column
});

test("extractStopsFromZip: finds stops.txt by name or suffix", () => {
  const zip = makeZip([
    { name: "stops.txt", data: Buffer.from(STOPS) },
    { name: "routes.txt", data: Buffer.from("route_id\n1") },
  ]);
  const stops = extractStopsFromZip(zip);
  assert.equal(stops.length, 2);
  assert.equal(stops[1].gtfsStopId, "502");
});

test("extractStopsFromZip: errors when stops.txt is absent", () => {
  const zip = makeZip([{ name: "routes.txt", data: Buffer.from("route_id\n1") }]);
  assert.throws(() => extractStopsFromZip(zip), /stops.txt not found/);
});

test("readStopsFeed: reads a raw stops.txt file and filters by city", async () => {
  const dir = tmpdir();
  const raw = join(dir, `shadestop-raw-${process.pid}.txt`);
  writeFileSync(raw, STOPS);
  const all = await readStopsFeed(raw);
  assert.equal(all.length, 2);
  const hot = await readStopsFeed(raw, { city: "hot" });
  assert.equal(hot.length, 1);
  assert.equal(hot[0].name, "Hot Avenue");
});

test("readStopsFeed: reads a zip file from disk", async () => {
  const dir = tmpdir();
  const zipPath = join(dir, `shadestop-zip-${process.pid}.zip`);
  writeFileSync(zipPath, makeZip([{ name: "stops.txt", data: Buffer.from(STOPS) }]));
  const stops = await readStopsFeed(zipPath);
  assert.equal(stops.length, 2);
  assert.equal(stops[0].name, "Test Street");
});
