import test from "node:test";
import assert from "node:assert/strict";
import {
  overpassQuery,
  parseOverpass,
  pseSearchUrl,
  parsePSE,
  analyzeSite,
  nextOsmTarget,
  OSM_CITIES,
  OSM_CATEGORIES,
} from "../src/sources.js";

test("overpass query is bounded, attributed and asks for websites only", () => {
  const q = overpassQuery({ city: "Leeds", category: { key: "shop", value: "bakery" }, limit: 25 });
  assert.match(q, /\[out:json\]\[timeout:20\]/);
  assert.match(q, /area\[name="Leeds"\]/);
  assert.match(q, /nwr\["shop=bakery"\]\["website"\]/);
  assert.match(q, /out center 25;/);
});

test("overpass results keep public details and never invent an email", () => {
  const parsed = parseOverpass({
    elements: [
      {
        type: "node",
        tags: {
          name: "North Bakery",
          website: "northbakery.example",
          "contact:phone": "+44 113 000 0000",
          "addr:street": "12 High Street",
          "addr:city": "Leeds",
          shop: "bakery",
        },
      },
      { type: "node", tags: { name: "No website here" } },
    ],
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].website, "https://northbakery.example");
  assert.equal(parsed[0].phone, "+44 113 000 0000");
  assert.equal(parsed[0].source, "OPENSTREETMAP");
  assert.equal(parsed[0].email, undefined);
  const many = parseOverpass(
    { elements: Array.from({ length: 60 }, (_, i) => ({ tags: { name: "S" + i, website: "https://s" + i + ".example" } })) },
    30,
  );
  assert.equal(many.length, 30);
});

test("placeholder search url encodes the query and never carries a key in the query string twice", () => {
  const u = pseSearchUrl({ key: "K1", cx: "CX1", query: 'cafe "Dhaka"', num: 10, start: 11 });
  assert.match(u, /key=K1/);
  assert.match(u, /cx=CX1/);
  assert.match(u, /start=11/);
  assert.match(u, /cafe%20%22Dhaka%22/);
  const items = parsePSE({ items: [{ link: "https://a.example/", title: "A" }] });
  assert.deepEqual(items, [{ url: "https://a.example/", title: "A" }]);
  assert.deepEqual(parsePSE({}), []);
});

test("site analysis reads platform, tracking, socials, language and hiring signals", () => {
  const wp = analyzeSite(
    '<html><head><link href="/wp-content/themes/x.css"><script src="https://www.googletagmanager.com/gtm.js"></script></head><body>We are hiring! Follow https://www.linkedin.com/company/acme and https://instagram.com/acme</body></html>',
  );
  assert.equal(wp.platform, "wordpress");
  assert.equal(wp.analytics, true);
  assert.equal(wp.hiringSignal, true);
  assert.equal(wp.socials.instagram, "https://instagram.com/acme");
  assert.match(wp.socials.linkedin, /linkedin\.com\/company\/acme/);
  const wix = analyzeSite("built with static.parastorage.com — wix");
  assert.equal(wix.platform, "wix");
  assert.equal(wix.analytics, false);
  assert.equal(wix.hiringSignal, false);
  assert.equal(analyzeSite("আমাদের সেবা সম্পর্কে").language, "bn");
  assert.equal(analyzeSite("Nuestros servicios y contacto").language, "es");
  assert.equal(analyzeSite("About our company").language, "en");
});

test("openstreetmap rotation covers cities and categories without repeating pairs", () => {
  const seen = new Set();
  for (let i = 0; i < OSM_CITIES.length * OSM_CATEGORIES.length; i++) {
    const t = nextOsmTarget(i);
    seen.add(t.city.city + "|" + t.category.value);
  }
  assert.ok(seen.size >= OSM_CATEGORIES.length);
  const t = nextOsmTarget(0);
  assert.equal(t.city.city, OSM_CITIES[0].city);
  assert.equal(t.category.value, OSM_CATEGORIES[0].value);
});
