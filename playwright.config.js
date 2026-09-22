import { defineConfig } from "@playwright/test";
const ci = !!process.env.CI;
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.js",
  workers: 1,
  // Slower CI runners get one retry so a genuine flake does not fail the build;
  // the diagnostics step still prints every attempt, so nothing is hidden.
  retries: ci ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  webServer: {
    command:
      "npx wrangler d1 execute DB --local --file migrations/0001.sql && npm run dev",
    url: "http://127.0.0.1:4180",
    reuseExistingServer: !ci,
    timeout: 90000,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    baseURL: "http://127.0.0.1:4180",
    trace: ci ? "retain-on-failure" : "off",
    screenshot: ci ? "only-on-failure" : "off",
  },
  reporter: [[
    "list",
  ], ["json", { outputFile: "test-results/browser.json" }]],
});
