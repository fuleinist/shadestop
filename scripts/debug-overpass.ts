// Debug why shadeQuery returns 0 assets in known parks.
import { shadeQuery, parseShadeAssets } from "../src/overpass.js";

const EP = "https://overpass.osm.ch/api/interpreter";

async function run(label: string, q: string) {
  const res = await fetch(EP, {
    method: "POST",
    body: new URLSearchParams({ data: q }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "shadestop/0.1 (research)",
    },
  });
  const text = await res.text();
  let count = -1;
  let trees = 0;
  let parseErr = "";
  try {
    const json = JSON.parse(text);
    count = json.elements?.length ?? 0;
    const assets = parseShadeAssets(json);
    trees = assets.filter((a: { kind: string }) => a.kind === "tree").length;
  } catch (e) {
    parseErr = String(e);
  }
  console.log(`${label}: http=${res.status} elements=${count} parsedTrees=${trees} ${parseErr}`);
  return res.status;
}

// Centennial Park center ~ -33.9089, 151.1875
const center = { lat: -33.9089, lon: 151.1875 };

// 1) Hand-written correct box: (south, west, north, east)
const handTree =
  '[out:json][timeout:20];(nwr["natural"="tree"](-33.914,151.183,-33.903,151.192));out 50;';
await run("hand tree box", handTree);

// 2) My generated query around the same center
const generated = shadeQuery(center.lat, center.lon, 300);
console.log("generated query:\n" + generated);
await run("generated query", generated);

// 3) Is any tree anywhere in a big box? (sanity: OSM has trees in Sydney)
const bigBox =
  '[out:json][timeout:30];(nwr["natural"="tree"](-33.93,151.16,-33.88,151.22));out count;';
const res = await fetch(EP, {
  method: "POST",
  body: new URLSearchParams({ data: bigBox }),
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    "user-agent": "shadestop/0.1 (research)",
  },
});
console.log("big-box count query:\n" + (await res.text()).slice(0, 400));
