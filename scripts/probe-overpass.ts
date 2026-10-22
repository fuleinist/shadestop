// Confirm which endpoint has CURRENT tree data (Centennial Park must have trees).
import { shadeQuery } from "../src/overpass.js";

const q = shadeQuery(-33.9089, 151.1875, 300);
const body = new URLSearchParams({ data: q });
const eps = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];
for (const ep of eps) {
  const ctrl = new AbortController();
  const cap = setTimeout(() => ctrl.abort(), 20000);
  const t0 = Date.now();
  try {
    const res = await fetch(ep, {
      method: "POST",
      body,
      signal: ctrl.signal,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "shadestop/0.1 (research)",
      },
    });
    clearTimeout(cap);
    let info = `http=${res.status}`;
    if (res.ok) {
      const j = await res.json();
      const trees = (j.elements ?? []).filter(
        (e: { tags?: Record<string, string> }) => e.tags?.natural === "tree",
      ).length;
      info = `http=200 trees=${trees}`;
    } else {
      const txt = await res.text();
      info = `http=${res.status} ${txt.slice(0, 60).replace(/\n/g, " ")}`;
    }
    console.log(`${ep}  ${info}  (${Date.now() - t0}ms)`);
  } catch (e) {
    clearTimeout(cap);
    console.log(`${ep}  ERROR ${(e as Error).message} (${Date.now() - t0}ms)`);
  }
}
