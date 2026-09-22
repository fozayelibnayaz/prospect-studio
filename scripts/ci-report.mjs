import fs from "node:fs";

const strip = (s) => String(s || "").replace(/\u001b\[[0-9;]*m/g, "");
const file = "test-results/browser.json";
if (!fs.existsSync(file)) {
  console.log("=".repeat(72));
  console.log("BROWSER TEST DIAGNOSTICS");
  console.log("=".repeat(72));
  console.log(
    "No browser.json report was produced — Playwright failed before running any test (usually the web server never started).",
  );
  console.log("Scroll up to the 'Browser tests' step output for the server error.");
  process.exit(0);
}
let r;
try {
  r = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.log("Could not parse " + file + ": " + e.message);
  process.exit(0);
}
const specs = [];
(function walk(suite, path) {
  const p = suite.title && suite.file ? [...path, suite.title] : path;
  for (const s of suite.suites || []) walk(s, p);
  for (const spec of suite.specs || []) specs.push({ spec, path: p });
})({ suites: r.suites || [] }, []);
const statuses = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
const bad = [];
for (const { spec, path } of specs) {
  for (const t of spec.tests || []) {
    statuses[t.status] = (statuses[t.status] || 0) + 1;
    if (t.status === "unexpected" || t.status === "flaky")
      bad.push({ spec, t, path });
  }
}
console.log("=".repeat(72));
console.log("BROWSER TEST DIAGNOSTICS (read this in the GitHub log)");
console.log("=".repeat(72));
console.log(
  `total ${Object.values(statuses).reduce((a, b) => a + b, 0)} · passed ${statuses.expected || 0} · failed ${statuses.unexpected || 0} · flaky ${statuses.flaky || 0} · skipped ${statuses.skipped || 0}`,
);
for (const e of r.errors || []) {
  console.log("");
  console.log("RUN-LEVEL ERROR: " + strip(e.message).slice(0, 1500));
}
if (!bad.length) {
  console.log(
    (r.errors || []).length
      ? "Tests themselves passed; the run-level error above is the failure."
      : "No failing browser tests.",
  );
  process.exit(0);
}
for (const { spec, t, path } of bad) {
  console.log("");
  console.log(`FAILED [${t.status}] ${[...path, spec.title].join(" › ")}`);
  console.log(`  file: ${spec.file}${spec.line ? ":" + spec.line : ""}`);
  for (const res of t.results || []) {
    const err = (res.errors || []).find((x) => x && x.message) || res.error;
    console.log(`  attempt ${(res.retry || 0) + 1} (${res.status}):`);
    if (err) console.log("  " + strip(err.message).slice(0, 1200).replace(/\n/g, "\n  "));
    if (res.error?.location?.file)
      console.log(`  at ${res.error.location.file}:${res.error.location.line || ""}`);
  }
}
console.log("");
console.log("Trace, screenshots and error context: 'browser-results' artifact on this run.");
