// Try reachable Overpass endpoints with the REAL shade query; report status + time.
import { shadeQuery } from "../src/overpass.js";
const q = shadeQuery(-33.8748, 151.213, 100);
const endpoints = [
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const body = new URLSearchParams({ data: q });
for (const ep of endpoints) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const cap = setTimeout(() => ctrl.abort(), 15000);
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
    const ms = Date.now() - t0;
    const ct = res.headers.get("content-type") ?? "";
    let snippet = "";
    if (ct.includes("json")) snippet = (await res.text()).slice(0, 200);
    else snippet = "(non-json) " + (await res.text()).slice(0, 120);
    console.log(`\n${ep}\n  status ${res.status} in ${ms}ms\n  ${snippet}`);
  } catch (e) {
    clearTimeout(cap);
    console.log(`\n${ep}\n  ERROR ${(e as Error).message} after ${Date.now() - t0}ms`);
  }
}
