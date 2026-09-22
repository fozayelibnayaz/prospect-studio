import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.js",
  workers: 1,
  webServer: {
    command:
      "npx wrangler d1 execute DB --local --file migrations/0001.sql && npm run dev",
    url: "http://127.0.0.1:4180",
    reuseExistingServer: !process.env.CI,
    timeout: 90000,
  },
  use: { baseURL: "http://127.0.0.1:4180" },
  reporter: [["list"], ["json", { outputFile: "test-results/browser.json" }]],
});
