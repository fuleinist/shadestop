import test from "node:test";
import assert from "node:assert/strict";
import {
  shadeQuery,
  parseShadeAssets,
  fetchShadeAssets,
  OVERPASS_ENDPOINTS,
} from "../src/overpass.js";

const fixture = {
  elements: [
    { type: "node", id: 1, lat: -33.87, lon: 151.21, tags: { natural: "tree" } },
    { type: "node", id: 2, lat: -33.8701, lon: 151.2101, tags: { natural: "tree" } },
    { type: "way", id: 3, center: { lat: -33.8702, lon: 151.2102 }, tags: { natural: "tree" } },
    { type: "node", id: 4, lat: -33.87, lon: 151.21, tags: { public_transport: "shelter" } },
    { type: "node", id: 5, lat: -33.87, lon: 151.21, tags: { drinking_water: "yes" } },
    { type: "node", id: 6, lat: -33.87, lon: 151.21, tags: { drinking_water: "yes", shower: "yes" } },
    { type: "node", id: 7, lat: -33.87, lon: 151.21, tags: { amenity: "bank" } },
  ],
};

test("shadeQuery includes all three asset filters and a bbox", () => {
  const q = shadeQuery(-33.87, 151.21, 100);
  assert.ok(q.includes('"natural"="tree"'));
  assert.ok(q.includes('"public_transport"="shelter"'));
  assert.ok(q.includes('"drinking_water"="yes"'));
  // Box corners appear as numbers.
  assert.ok(q.includes("151.21"));
});

test("parseShadeAssets counts trees, shelters, fountains once each", () => {
  const assets = parseShadeAssets(fixture);
  const trees = assets.filter((a) => a.kind === "tree").length;
  const shelters = assets.filter((a) => a.kind === "shelter").length;
  const fountains = assets.filter((a) => a.kind === "fountain").length;
  assert.equal(trees, 3);
  assert.equal(shelters, 1);
  assert.equal(fountains, 1);
  assert.equal(assets.length, 5);
});

test("parseShadeAssets skips elements without coordinates", () => {
  const json = {
    elements: [{ type: "relation", id: 99, tags: { natural: "tree" } }],
  };
  assert.equal(parseShadeAssets(json).length, 0);
});

test("fetchShadeAssets parses a mocked successful response", async () => {
  let seenUrl = "";
  let seenData = "";
  const fakeFetch: typeof fetch = async (url, init) => {
    seenUrl = String(url);
    seenData = String(new URLSearchParams(init?.body as string));
    return new Response(JSON.stringify(fixture), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const assets = await fetchShadeAssets(-33.87, 151.21, {
    endpoint: "https://example.test/interpreter",
    fetchImpl: fakeFetch,
  });
  assert.equal(assets.length, 5);
  assert.equal(seenUrl, "https://example.test/interpreter");
  assert.ok(seenData.includes("data="));
});

test("fetchShadeAssets surfaces HTTP errors", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response("boom", { status: 500 });
  await assert.rejects(
    () => fetchShadeAssets(-33.87, 151.21, { fetchImpl: fakeFetch }),
    /overpass http 500/,
  );
});

test("fetchShadeAssets rotates to the next endpoint on 5xx", async () => {
  let firstUrl = "";
  const fakeFetch: typeof fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("bad.example")) {
      firstUrl = u;
      return new Response("boom", { status: 502 });
    }
    return new Response(JSON.stringify(fixture), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const assets = await fetchShadeAssets(-33.87, 151.21, {
    endpoints: ["https://bad.example/interpreter", "https://good.example/interpreter"],
    fetchImpl: fakeFetch,
    attempts: 1,
  });
  assert.equal(assets.length, 5);
  assert.ok(firstUrl.includes("bad.example"));
});

test("fetchShadeAssets stops rotating on 4xx (bad query)", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response("bad query", { status: 400 });
  await assert.rejects(
    () =>
      fetchShadeAssets(-33.87, 151.21, {
        endpoints: ["https://a.example/i", "https://b.example/i"],
        fetchImpl: fakeFetch,
      }),
    /overpass http 400/,
  );
});

test("fetchShadeAssets throws when all endpoints fail", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response("busy", { status: 502 });
  await assert.rejects(
    () =>
      fetchShadeAssets(-33.87, 151.21, {
        endpoints: ["https://a.example/i", "https://b.example/i"],
        fetchImpl: fakeFetch,
        attempts: 1,
      }),
    /all overpass endpoints failed/,
  );
});

test("default endpoint list covers public Overpass instances", () => {
  assert.ok(OVERPASS_ENDPOINTS.length >= 2);
  assert.ok(OVERPASS_ENDPOINTS.every((e) => e.includes("overpass")));
});
