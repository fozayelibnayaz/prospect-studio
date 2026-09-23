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
test("all sections render", async ({ page }) => {
  await page.goto("/");
  for (const name of [
    "Prospects",
    "Review & send",
    "Email activity",
    "Sales pipeline",
    "Customers",
    "Marketing",
    "Work & follow-ups",
    "Reports & learning",
    "Automation",
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
    // Content area must not contain injected elements (sidebar brand image is expected chrome).
    await expect(page.locator(".main img")).toHaveCount(0);
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
  for (const v of [
    "overview",
    "prospects",
    "review",
    "mail",
    "settings",
    "reports",
    "automation",
    "marketing",
  ]) {
    await page.goto("/#" + v);
    await expect(page.locator("h1")).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations).toEqual([]);
  }
});

test("email activity lists sent messages with full text", async ({ page }) => {
  await page.goto("/#mail");
  await expect(
    page.getByRole("heading", { name: "Email activity" }),
  ).toBeVisible();
  await expect(page.getByText("→ SENT").first()).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "→ SENT" })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".mail-body")).not.toBeEmpty();
  await page.getByRole("button", { name: "Close dialog" }).click();
});

test("automation view shows every worker with status and quick actions", async ({
  page,
}) => {
  await page.goto("/#automation");
  for (const name of [
    "Discovery",
    "Outreach sending",
    "Reply watch",
    "Daily content",
    "Reports & digest",
    "AI assist",
    "Compliance guards",
  ])
    await expect(
      page.getByText(name, { exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Process one eligible message" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync now" })).toBeVisible();
});

test("marketing: write a concept draft, then update it", async ({ page }) => {
  await page.goto("/#marketing");
  await expect(page.getByText("Content autopilot", { exact: true })).toBeVisible();
  await page.locator("#conceptBox").fill("Why local clinics lose enquiries at 8pm");
  await page.getByRole("button", { name: "Write draft from concept" }).click();
  await expect(page.getByText("from your concept").first()).toBeVisible();
  await page.getByRole("button", { name: "Update", exact: true }).first().click();
  await page.getByRole("textbox", { name: "New instructions" }).fill("Mention a shared dashboard");
  await page.getByRole("button", { name: "Rewrite post" }).click();
  await expect(page.locator("#toast")).toContainText("back in DRAFT");
});

test("overview shows what needs the owner's attention", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("NEEDS YOUR EYES:")).toBeVisible();
});

test("marketing: generate, edit, approve, post and record metrics", async ({
  page,
}) => {
  await page.goto("/#marketing");
  await page.getByRole("button", { name: /Generate today’s content/ }).click();
  const row = page
    .locator(".connected")
    .filter({
      has: page.getByRole("button", { name: "Approve", exact: true }),
    })
    .first();
  const id = await row
    .getByRole("button", { name: "Edit", exact: true })
    .getAttribute("data-editcontent");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Post text" })
    .fill("Edited fictional post for the test.");
  await page.getByRole("button", { name: "Save post" }).click();
  await row.getByRole("button", { name: "Approve", exact: true }).click();
  await row.getByRole("button", { name: "Mark posted", exact: true }).click();
  await expect(page.getByText("POSTED", { exact: true }).first()).toBeVisible();
  const reach = page.locator(`[data-metric-reach="${id}"]`);
  await reach.fill("250");
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/action") && r.request().method() === "POST",
    ),
    page
      .locator(`.connected:has([data-metric-reach="${id}"])`)
      .getByRole("button", { name: "Save metrics" })
      .click(),
  ]);
  await page.reload();
  await expect(page.locator(`[data-metric-reach="${id}"]`)).toHaveValue("250");
});
test("finance: record a payment once and see it in collected totals", async ({
  page,
}) => {
  await page.goto("/#finance");
  page.on("dialog", (d) => d.accept());
  const row = page.getByRole("row").filter({ hasText: "Mira Consulting" });
  await row.getByRole("button", { name: "Record payment" }).click();
  await expect(row.getByText("PAID", { exact: true })).toBeVisible();
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

test("automation: follow-up settings round-trip and run-now toast", async ({
  page,
}) => {
  await page.goto("/#automation");
  await expect(page.getByText("Follow-up autopilot", { exact: true }).first()).toBeVisible();
  await page.locator("#followUpDays").fill("6");
  await page.locator("#followUpMax").fill("2");
  await page.getByRole("button", { name: "Save follow-up settings" }).click();
  await expect(page.locator("#toast")).toContainText("Follow-up settings saved");
  await page.reload();
  await expect(page.locator("#followUpDays")).toHaveValue("6");
  await expect(page.locator("#followUpMax")).toHaveValue("2");
  await page.getByRole("button", { name: "Run follow-ups now" }).click();
  await expect(page.locator("#toast")).toContainText(/follow-up draft|quiet conversations|off/i);
  await page.screenshot({ path: "docs/automation.png", fullPage: true });
});

test("reports: export buttons download real files", async ({ page }) => {
  await page.goto("/#reports");
  const [x] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Email activity XLSX" }).click(),
  ]);
  expect(x.suggestedFilename()).toMatch(/Email-Activity-.*\.xlsx/);
  const [b] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Full backup JSON" }).click(),
  ]);
  expect(b.suggestedFilename()).toMatch(/Backup-.*\.json/);
});

test("reports: restore preview reads a backup file without writing", async ({ page }) => {
  await page.goto("/#reports");
  await expect(
    page.getByRole("heading", { name: "Restore from backup" }),
  ).toBeVisible();
  const backup = {
    app: "Prospect Studio",
    version: "0.4.2",
    objects: { leads: [{ id: "demo-1", company: "Replaced Name" }] },
  };
  await page.setInputFiles("#restoreFile", {
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole("button", { name: "Preview restore" }).click();
  await expect(page.locator("#restoreResult")).toContainText("Nothing has changed yet");
  await expect(page.locator("#restoreResult")).toContainText("leads");
});

test("automation: pause window and invoice reminder settings save", async ({ page }) => {
  await page.goto("/#automation");
  await expect(page.getByText("Invoice reminders", { exact: true }).first()).toBeVisible();
  await page.locator("#pauseWindows").fill("2026-12-20..2027-01-03");
  await page.locator("#invoiceRemindersT").uncheck();
  await page.getByRole("button", { name: "Save follow-up settings" }).click();
  await expect(page.locator("#toast")).toContainText("Follow-up settings saved");
  await page.reload();
  await expect(page.locator("#pauseWindows")).toHaveValue("2026-12-20..2027-01-03");
  await expect(page.locator("#invoiceRemindersT")).not.toBeChecked();
  await page.getByRole("button", { name: "Draft reminders now" }).click();
  await expect(page.locator("#toast")).toContainText(/off|reminder draft|overdue invoice/i);
});

test("finance: an overdue invoice drafts a tagged reminder", async ({ page }) => {
  await page.goto("/#finance");
  const row = page.getByRole("row").filter({ hasText: "Harbour & Pine" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Reminder draft" }).click();
  await expect(page.locator("#toast")).toContainText(/Reminder draft created|Nothing to draft/i);
  await page.goto("/#review");
  await expect(page.getByText("INVOICE", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Invoice reminder — 4,200 USD/).first()).toBeVisible();
});
