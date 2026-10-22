// Shade scoring from OSM assets, per SPEC.md.

import { haversineM, type GeoPoint } from "./geo.js";
import type { ShadeAsset } from "./overpass.js";
import type { ShadeInfo } from "./types.js";

const TREE_CANOPY_STEP = 0.08;
const CANOPY_CAP = 0.6;
const SHELTER_STEP = 0.1;
const SHELTER_CAP = 0.2;
const FOUNTAIN_STEP = 0.05;
const FOUNTAIN_CAP = 0.1;
const SHELTER_NEAR_M = 50;
const FOUNTAIN_NEAR_M = 30;

function countKind(assets: ShadeAsset[], kind: ShadeAsset["kind"]): number {
  let n = 0;
  for (const a of assets) if (a.kind === kind) n++;
  return n;
}

function minDistanceM(
  assets: ShadeAsset[],
  kind: ShadeAsset["kind"],
  at: GeoPoint,
): number | null {
  let best: number | null = null;
  for (const a of assets) {
    if (a.kind !== kind) continue;
    const d = haversineM(at, a);
    if (best === null || d < best) best = d;
  }
  return best;
}

// Combine asset counts into a shade fraction (0..1) plus proximity flags.
export function shadeInfoFromAssets(
  assets: ShadeAsset[],
  at: GeoPoint,
): ShadeInfo {
  const trees = countKind(assets, "tree");
  const shelters = countKind(assets, "shelter");
  const fountains = countKind(assets, "fountain");

  const canopy = Math.min(CANOPY_CAP, TREE_CANOPY_STEP * trees);
  const shelterCut = Math.min(SHELTER_CAP, SHELTER_STEP * shelters);
  const fountainCut = Math.min(FOUNTAIN_CAP, FOUNTAIN_STEP * fountains);
  const shadeFraction = Math.min(1, canopy + shelterCut + fountainCut);

  const shelterDist = minDistanceM(assets, "shelter", at);
  const fountainDist = minDistanceM(assets, "fountain", at);

  return {
    assets: { trees, shelters, fountains },
    shadeFraction,
    shelterWithin50m: shelterDist !== null && shelterDist <= SHELTER_NEAR_M,
    fountainWithin30m: fountainDist !== null && fountainDist <= FOUNTAIN_NEAR_M,
  };
}
