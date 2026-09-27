/* v0.6 fallback research sources.
 * All keyless or free-key. OpenStreetMap data: © OpenStreetMap contributors (ODbL).
 */
export const OSM_CITIES = [
  { city: "Bristol", country: "United Kingdom", code: "GB" },
  { city: "Leeds", country: "United Kingdom", code: "GB" },
  { city: "Manchester", country: "United Kingdom", code: "GB" },
  { city: "Cardiff", country: "United Kingdom", code: "GB" },
  { city: "Glasgow", country: "United Kingdom", code: "GB" },
  { city: "Brisbane", country: "Australia", code: "AU" },
  { city: "Adelaide", country: "Australia", code: "AU" },
  { city: "Perth", country: "Australia", code: "AU" },
  { city: "Hobart", country: "Australia", code: "AU" },
  { city: "Dhaka", country: "Bangladesh", code: "BD" },
  { city: "Chattogram", country: "Bangladesh", code: "BD" },
  { city: "Sylhet", country: "Bangladesh", code: "BD" },
  { city: "Toronto", country: "Canada", code: "CA" },
  { city: "Calgary", country: "Canada", code: "CA" },
  { city: "Portland", country: "United States", code: "US" },
  { city: "Austin", country: "United States", code: "US" },
  { city: "Denver", country: "United States", code: "US" },
  { city: "Dublin", country: "Ireland", code: "IE" },
  { city: "Auckland", country: "New Zealand", code: "NZ" },
  { city: "Rotterdam", country: "Netherlands", code: "NL" },
  { city: "Gothenburg", country: "Sweden", code: "SE" },
  { city: "Copenhagen", country: "Denmark", code: "DK" },
  { city: "Pune", country: "India", code: "IN" },
  { city: "Johannesburg", country: "South Africa", code: "ZA" },
];
export const OSM_CATEGORIES = [
  { key: "shop", value: "furniture" },
  { key: "shop", value: "interior_decoration" },
  { key: "shop", value: "doityourself" },
  { key: "shop", value: "garden_centre" },
  { key: "shop", value: "bakery" },
  { key: "shop", value: "car_repair" },
  { key: "shop", value: "beauty" },
  { key: "amenity", value: "restaurant" },
  { key: "amenity", value: "cafe" },
  { key: "amenity", value: "dentist" },
  { key: "amenity", value: "veterinary" },
  { key: "office", value: "estate_agent" },
  { key: "office", value: "accountant" },
  { key: "office", value: "lawyer" },
  { key: "craft", value: "plumber" },
  { key: "craft", value: "electrician" },
  { key: "leisure", value: "fitness_centre" },
  { key: "tourism", value: "guest_house" },
];
export function overpassQuery({ city, category, limit = 30 }) {
  const tag = category.key + "=" + category.value;
  return `[out:json][timeout:20];area[name="${city}"]["boundary"="administrative"]->.a;(nwr["${tag}"]["website"](area.a););out center ${limit};`;
}
export function parseOverpass(body, limit = 30) {
  const out = [];
  for (const el of body?.elements || []) {
    const t = el.tags || {};
    const website = t.website || t["contact:website"] || "";
    if (!website) continue;
    let url = String(website).split(";")[0].trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    out.push({
      name: String(t.name || "").slice(0, 160),
      website: url,
      phone: String(t.phone || t["contact:phone"] || "").slice(0, 40),
      address: [t["addr:housenumber"], t["addr:street"], t["addr:city"]]
        .filter(Boolean)
        .join(" ")
        .slice(0, 160),
      category: t[categoryKeyFallback(t)] || "",
      source: "OPENSTREETMAP",
    });
    if (out.length >= limit) break;
  }
  return out.filter((x) => x.name);
}
function categoryKeyFallback(t) {
  for (const k of ["shop", "amenity", "office", "craft", "leisure", "tourism"])
    if (t[k]) return k;
  return "shop";
}
export function pseSearchUrl({ key, cx, query, num = 10, start = 1 }) {
  return (
    "https://www.googleapis.com/customsearch/v1?key=" +
    encodeURIComponent(key) +
    "&cx=" +
    encodeURIComponent(cx) +
    "&num=" +
    num +
    "&start=" +
    start +
    "&q=" +
    encodeURIComponent(query)
  );
}
export function parsePSE(body) {
  return (body?.items || []).map((i) => ({
    url: i.link,
    title: i.title || "",
  }));
}
export function analyzeSite(text) {
  const t = String(text || "");
  const lower = t.toLowerCase();
  let platform = "unknown";
  if (/wp-content|wp-includes|wordpress/.test(lower)) platform = "wordpress";
  else if (/cdn\.shopify\.com|shopify/.test(lower)) platform = "shopify";
  else if (/wix\.com|wixsite|static\.parastorage/.test(lower)) platform = "wix";
  else if (/squarespace/.test(lower)) platform = "squarespace";
  else if (/godaddy|websitebuilder/.test(lower)) platform = "godaddy";
  else if (/woocommerce/.test(lower)) platform = "woocommerce";
  else if (/\.(php|aspx|jsp)|<html/.test(lower)) platform = "custom";
  let analytics = false;
  if (/googletagmanager|gtag\(|google-analytics|ga4|ua-\d{4,}/.test(lower))
    analytics = true;
  const socials = {};
  for (const [key, re] of [
    ["linkedin", /https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/[^\s"'<>)]+/i],
    ["facebook", /https?:\/\/([a-z]{2,3}\.)?facebook\.com\/[^\s"'<>)]+/i],
    ["instagram", /https?:\/\/instagram\.com\/[^\s"'<>)]+/i],
    ["x", /https?:\/\/(www\.)?(x|twitter)\.com\/[^\s"'<>)]+/i],
  ]) {
    const m = t.match(re);
    if (m) socials[key] = m[0].slice(0, 200);
  }
  const hiringSignal = /(we(?:'| a)?re hiring|join our team|careers page|vacanc|now hiring|job opening)/i.test(
    t,
  );
  const spanish = /\b(nosotros|servicios|contacto|empresa)\b/i.test(t);
  const bangla = /[\u0980-\u09FF]/.test(t);
  let language = "en";
  if (bangla) language = "bn";
  else if (spanish) language = "es";
  return { platform, analytics, socials, hiringSignal, language };
}
export function nextOsmTarget(cursor) {
  return {
    city: OSM_CITIES[cursor % OSM_CITIES.length],
    category: OSM_CATEGORIES[cursor % OSM_CATEGORIES.length],
  };
}
