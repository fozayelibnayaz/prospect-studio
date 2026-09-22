import fs from "node:fs";

// Parse .jsonc safely: strip // and /* */ comments and trailing commas
// while respecting string literals (so URLs like https://... survive).
function jsoncToJson(text) {
  let out = "";
  let inStr = false;
  let esc = false;
  const isWs = (c) => c === " " || c === "\t" || c === "\n" || c === "\r";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < text.length && isWs(text[j])) j++;
      if (text[j] === "}" || text[j] === "]") continue; // drop trailing comma
    }
    out += ch;
  }
  return out;
}

const c = JSON.parse(jsoncToJson(fs.readFileSync("wrangler.jsonc", "utf8"))).env
  .production;
if (c.vars.DEMO_MODE !== "false")
  throw Error("Production DEMO_MODE must be false.");
if (!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test(c.vars.APP_ORIGIN))
  throw Error(
    "Set production APP_ORIGIN to the exact HTTPS workers.dev URL, without a trailing slash.",
  );
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.vars.OWNER_EMAIL))
  throw Error("Set OWNER_EMAIL to your Google sign-in email.");
if (!/^[0-9a-f-]{36}$/.test(c.d1_databases[0].database_id))
  throw Error("Replace the production D1 database ID.");
// Owner-confirmed states must survive every future deploy. If your real-world
// situation changes, edit the flag deliberately (and this check) — never by accident.
if (c.vars.AI_FREE_CONFIRMED !== "true")
  throw Error(
    'Production AI_FREE_CONFIRMED must stay "true" (owner-confirmed free tier). Set it in wrangler.jsonc env.production.vars and redeploy.',
  );
if (c.vars.TAVILY_PAYGO_DISABLED_CONFIRMED !== "true")
  throw Error(
    'Production TAVILY_PAYGO_DISABLED_CONFIRMED must stay "true" (PAYG disabled, no card). Set it in wrangler.jsonc env.production.vars and redeploy.',
  );
console.log(
  "Public deployment settings passed. Secrets and account authorization still require live checks.",
);
