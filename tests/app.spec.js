import { test, expect } from "@playwright/test";
test.beforeAll(async ({ request }) => {
  await request.post("/api/action", { data: { action: "resetDemo" } });
});
test("dashboard clearly labels fictional demo and global rotation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("INTERACTIVE DEMO", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("249 markets", { exact: true })).toBeVisible();
  await page.screenshot({ path: "docs/desktop.png", fullPage: true });
});
test("all eight sections render", async ({ page }) => {
  await page.goto("/");
  for (const name of [
    "Prospects",
    "Review & send",
    "Sales pipeline",
    "Customers",
    "Work & follow-ups",
    "Reports & learning",
    "Settings",
    "Overview",
  ]) {
    await page.locator("nav").getByRole("link", { name, exact: true }).click();
    await expect(page.locator("h1")).toBeVisible();
  }
});
test("review modal shows evidence and no inferred consent", async ({
  page,
}) => {
  await page.goto("/#prospects");
  await page.getByRole("button", { name: "Review ↗" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Contact basis", exact: true }),
  ).toBeVisible();
  await expect(page.locator("select[name=consent]")).toHaveValue("NONE");
  await page.getByRole("button", { name: "Close dialog" }).click();
});
test("search does not execute HTML", async ({ page }) => {
  await page.goto("/#prospects");
  await page.getByRole("searchbox").fill("<img src=x onerror=alert(1)>");
  await expect(page.getByText("No matching prospects yet")).toBeVisible();
  await expect(page.locator("img")).toHaveCount(0);
});
test("mode changes persist and can restore broad", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Focused targeting/ }).click();
  await expect(page.getByText("3 markets", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("3 markets", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Broad discovery/ }).click();
  await expect(page.getByText("249 markets", { exact: true })).toBeVisible();
});
test("sending opt-in toggle requires confirmation and persists", async ({
  page,
}) => {
  await page.goto("/#review");
  page.on("dialog", (d) => d.accept());
  const box = page.getByRole("checkbox");
  await box.check();
  await expect(box).toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.getByRole("checkbox").uncheck();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
});
test("draft creation does not send and approval without evidence rejects", async ({
  page,
}) => {
  await page.goto("/#prospects");
  await page
    .getByRole("row")
    .filter({ hasText: "Northline Studio" })
    .getByRole("button", { name: "Review ↗" })
    .click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page).toHaveURL(/#review/);
  await expect(page.getByText("DRAFT", { exact: true }).first()).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Approve this message" })
    .first()
    .click();
  await expect(page.locator("#toast")).toContainText("evidence");
});
test("daily snapshot exports genuine XLSX", async ({ page }) => {
  await page.goto("/#reports");
  await page.getByRole("button", { name: "Create today’s snapshot" }).click();
  await expect(
    page.getByRole("button", { name: "Download XLSX" }).first(),
  ).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download XLSX" }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /Ayaz-Prospect-Research-.*\.xlsx/,
  );
});
test("mobile layout has no body overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "docs/mobile.png", fullPage: true });
});
test("held contact cannot create an outreach draft", async ({ page }) => {
  await page.goto("/#prospects");
  await page
    .getByRole("row")
    .filter({ hasText: "Forma Collective" })
    .getByRole("button", { name: "Review ↗" })
    .click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("hold");
  await expect(page).toHaveURL(/#prospects/);
});
test("task completion persists", async ({ page }) => {
  await page.goto("/#tasks");
  await page.getByRole("button", { name: "Mark done" }).first().click();
  await expect(page.getByText("DONE", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("DONE", { exact: true }).first()).toBeVisible();
});
test("review dialog supports Escape", async ({ page }) => {
  await page.goto("/#prospects");
  await page.getByRole("button", { name: "Review ↗" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("accessibility audit of main views", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  for (const v of ["overview", "prospects", "review", "settings", "reports"]) {
    await page.goto("/#" + v);
    await expect(page.locator("h1")).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations).toEqual([]);
  }
});

test("marketing: generate, edit, approve, post and record metrics", async ({
  page,
}) => {
  await page.goto("/#marketing");
  await page.getByRole("button", { name: /Generate today’s content/ }).click();
  const draft = page.getByRole("button", { name: "Edit" }).first();
  await draft.click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Post text" })
    .fill("Edited fictional post for the test.");
  await page.getByRole("button", { name: "Save post" }).click();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.getByRole("button", { name: "Mark posted" }).first().click();
  await expect(page.getByText("POSTED", { exact: true }).first()).toBeVisible();
  const reach = page.locator("[data-metric-reach]").first();
  await reach.fill("250");
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/action") && r.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save metrics" }).first().click(),
  ]);
  await page.reload();
  await expect(reach.first()).toHaveValue("250");
});
test("finance: record a payment once and see it in collected totals", async ({
  page,
}) => {
  await page.goto("/#finance");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Record payment" }).first().click();
  await expect(page.getByText("PAID", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".stat-value").first()).toContainText("15,000");
});
test("customers: weekly digest builds and satisfaction is recorded", async ({
  page,
}) => {
  await page.goto("/#customers");
  await page.getByRole("button", { name: "Build weekly digest" }).click();
  await expect(page.getByText(/Weekly digest — week of/)).toBeVisible();
  await page.getByRole("button", { name: "4" }).first().click();
  await expect(page.getByText("4/5 recorded").first()).toBeVisible();
});
