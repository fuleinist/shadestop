import test from "node:test";
import assert from "node:assert/strict";
import { shadeInfoFromAssets } from "../src/shade.js";
import type { ShadeAsset } from "../src/overpass.js";

const AT = { lat: -33.87, lon: 151.21 };

function mk(kind: ShadeAsset["kind"], latOffDeg = 0, lonOffDeg = 0): ShadeAsset {
  return { kind, lat: AT.lat + latOffDeg, lon: AT.lon + lonOffDeg };
}

// ~metres to degrees of latitude.
const perM = 1 / 111320;

test("empty asset set: zero shade, no proximity flags", () => {
  const info = shadeInfoFromAssets([], AT);
  assert.equal(info.assets.trees, 0);
  assert.equal(info.shadeFraction, 0);
  assert.equal(info.shelterWithin50m, false);
  assert.equal(info.fountainWithin30m, false);
});

test("ten trees hit the canopy cap at 0.6", () => {
  const assets = Array.from({ length: 10 }, () => mk("tree"));
  const info = shadeInfoFromAssets(assets, AT);
  assert.ok(Math.abs(info.shadeFraction - 0.6) < 1e-9, `f=${info.shadeFraction}`);
});

test("shade fraction sums capped components and caps at 1.0", () => {
  // 20 trees (0.6 cap) + 3 shelters (0.2 cap? 3*0.1=0.3 -> cap 0.2) + 20 fountains (0.1 cap)
  const assets = [
    ...Array.from({ length: 20 }, () => mk("tree")),
    ...Array.from({ length: 3 }, () => mk("shelter")),
    ...Array.from({ length: 20 }, () => mk("fountain")),
  ];
  const info = shadeInfoFromAssets(assets, AT);
  // 0.6 + 0.2 + 0.1 = 0.9
  assert.ok(Math.abs(info.shadeFraction - 0.9) < 1e-9, `f=${info.shadeFraction}`);
});

test("shelter within 50 m sets the flag, at 80 m it does not", () => {
  const near = [mk("shelter", 30 * perM)];
  const far = [mk("shelter", 80 * perM)];
  assert.equal(shadeInfoFromAssets(near, AT).shelterWithin50m, true);
  assert.equal(shadeInfoFromAssets(far, AT).shelterWithin50m, false);
});

test("fountain within 30 m sets the flag, at 40 m it does not", () => {
  const near = [mk("fountain", 20 * perM)];
  const far = [mk("fountain", 40 * perM)];
  assert.equal(shadeInfoFromAssets(near, AT).fountainWithin30m, true);
  assert.equal(shadeInfoFromAssets(far, AT).fountainWithin30m, false);
});
