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
  await expect(page.getByText(/\d+ cities in \d+ countries/)).toBeVisible();
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
    "Growth & goals",
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
  await expect(page.getByText(/3 focused countries/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/3 focused countries/)).toBeVisible();
  await page.getByRole("button", { name: /Broad discovery/ }).click();
  await expect(page.getByText(/\d+ cities in \d+ countries/)).toBeVisible();
});
test("sending opt-in toggle requires confirmation and persists", async ({
  page,
}) => {
  await page.goto("/#review");
  page.on("dialog", (d) => d.accept());
  const box = page.locator('input[data-toggle="autoSendOptIn"]').first();
  await expect(box).toBeChecked();
  await box.uncheck();
  await expect(box).not.toBeChecked();
  await page.reload();
  await expect(page.locator('input[data-toggle="autoSendOptIn"]').first()).not.toBeChecked();
  await page.locator('input[data-toggle="autoSendOptIn"]').first().check();
  await expect(page.locator('input[data-toggle="autoSendOptIn"]').first()).toBeChecked();
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

test("v0.6: urgent replies shout on the overview and close when handled", async ({ page }) => {
  await page.goto("/#overview");
  await expect(page.getByText("Urgent replies — handle first")).toBeVisible();
  await expect(page.getByText(/ready to sign/i)).toBeVisible();
  await page.getByRole("button", { name: "Mark handled" }).first().click();
  await expect(page.getByText("Marked handled — the task is closed too.")).toBeVisible();
  await page.goto("/#overview");
  await expect(page.getByText("Urgent replies — handle first")).toBeHidden();
});

test("v0.6: workspace language switches to Bangla and back", async ({ page }) => {
  await page.goto("/#overview");
  await page.getByRole("button", { name: "বাংলা" }).click();
  await expect(page.getByRole("button", { name: "EN" })).toBeVisible();
  await expect(page.locator("nav").getByText("সেটিংস")).toBeVisible();
  await page.reload();
  await expect(page.locator("nav").getByText("গ্রোথ ও লক্ষ্য")).toBeVisible();
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.locator("nav").getByText("Settings")).toBeVisible();
});

test("v0.6: growth view builds plan, playbook steps and content drafts", async ({ page }) => {
  await page.goto("/#growth");
  await expect(page.getByText("Goals & pace")).toBeVisible();
  await expect(page.locator("h2", { hasText: "First-customers playbook" })).toBeVisible();
  await page.getByLabel("What do you offer?").fill("websites and reporting");
  await page.getByLabel("Who is it for?").fill("small cafes");
  await page.getByRole("button", { name: "Build my 30-day plan" }).click();
  await expect(page.getByText(/dated tasks added/)).toBeVisible();
  await page.goto("/#growth");
  await page.locator("[data-play]").first().check();
  await page.getByRole("button", { name: "Add selected as tasks" }).click();
  await expect(page.getByText("1 step(s) added to your Work board.")).toBeVisible();
  await page.locator("[data-starter]").first().check();
  await page.getByRole("button", { name: "Add selected as content drafts" }).click();
  await expect(page.getByText("1 draft(s) added")).toBeVisible();
  await page.goto("/#tasks");
  await expect(page.getByText("Message 10 businesses").first()).toBeVisible();
});

test("v0.6: goals save and show a pace bar, health check runs", async ({ page }) => {
  await page.goto("/#growth");
  await page.getByLabel("Monthly revenue goal").fill("30000");
  await page.getByLabel("Monthly new customers goal").fill("4");
  await page.getByRole("button", { name: "Save goals" }).click();
  await expect(page.getByText(/Goals saved/)).toBeVisible();
  await page.goto("/#growth");
  await expect(page.locator(".goal-bar").first()).toBeVisible();
  await expect(page.getByLabel("Monthly revenue goal")).toHaveValue("30000");
  await page.getByRole("button", { name: "Run health check" }).click();
  await expect(page.getByText(/Operation completed|check/i).first()).toBeVisible();
});

test("v0.6: settings expose language, urgent alerts, provider fallback status and fit scores", async ({ page }) => {
  await page.goto("/#settings");
  await expect(page.getByText("Urgent reply alerts")).toBeVisible();
  await expect(page.getByLabel("Your own urgent keywords")).toBeVisible();
  await page.getByLabel("Your own urgent keywords").fill("ready to sign");
  await page.getByLabel("Also watch the whole inbox").check();
  await page.getByRole("button", { name: "Save language, alerts & goals" }).click();
  await expect(page.getByText("Language, alerts and goals saved.")).toBeVisible();
  await page.goto("/#automation");
  await expect(page.getByText("Urgent reply watch (every minute)")).toBeVisible();
  await expect(page.getByText("Discovery source / fallback")).toBeVisible();
  await page.goto("/#prospects");
  await page.locator("tbody [data-lead]").first().click();
  await expect(page.locator(".fit-chip").first()).toBeVisible();
  await expect(page.getByText("Analytics detected")).toBeVisible();
});

test("v0.7: growth shows the journey from discovery to a paid customer", async ({ page }) => {
  await page.goto("/#growth");
  await expect(page.locator("h2", { hasText: "Journey: start → paying customer" })).toBeVisible();
  await expect(page.getByText("Discovered ·", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/prospect\(s\) discovered/)).toBeVisible();
});

/* ============================ v0.8 owner feedback ======================== */
test("v0.8: automatic approval and sending are visible switches, ON by default, and can be turned off", async ({
  page,
}) => {
  await page.goto("/#automation");
  page.on("dialog", (d) => d.accept());
  const panel = page.locator("section.card", { hasText: "Automatic approval & sending" }).first();
  await expect(panel.getByText("ON BY DEFAULT")).toBeVisible();
  const approve = panel.locator('input[data-toggle="autoApprove"]');
  const send = panel.locator('input[data-toggle="autoSendOptIn"]');
  const verify = panel.locator('input[data-toggle="emailVerify"]');
  await expect(approve).toBeChecked();
  await expect(send).toBeChecked();
  await expect(verify).toBeChecked();
  await approve.uncheck();
  await expect(panel.getByText(/Manual mode is on/)).toBeVisible();
  await page.reload();
  await expect(
    page.locator("section.card", { hasText: "Automatic approval & sending" }).first().locator('input[data-toggle="autoApprove"]'),
  ).not.toBeChecked();
  await page
    .locator("section.card", { hasText: "Automatic approval & sending" })
    .first()
    .locator('input[data-toggle="autoApprove"]')
    .check();
  await expect(
    page.locator("section.card", { hasText: "Automatic approval & sending" }).first().getByText("ON BY DEFAULT"),
  ).toBeVisible();
});
test("v0.8: every Telegram alert case has its own switch, with a preview that shows why it fired", async ({
  page,
}) => {
  await page.goto("/#automation");
  const alerts = page.locator("section.card", { hasText: "Telegram alerts — every case" }).first();
  await expect(alerts).toBeVisible();
  await expect(alerts.locator("input[data-toggle^='notify']")).toHaveCount(11);
  await expect(alerts.locator('input[data-toggle="notifyAll"]')).toBeChecked();
  await alerts.locator('input[data-toggle="notifyContent"]').uncheck();
  await expect(alerts.locator('input[data-toggle="notifyContent"]')).not.toBeChecked();
  await page.reload();
  await expect(
    page.locator("section.card", { hasText: "Telegram alerts — every case" }).first().locator('input[data-toggle="notifyContent"]'),
  ).not.toBeChecked();
  await page
    .locator("section.card", { hasText: "Telegram alerts — every case" })
    .first()
    .locator('input[data-toggle="notifyContent"]')
    .check();
});
test("v0.8: prospect list has select-all, sorting and an honest address column", async ({
  page,
}) => {
  await page.goto("/#prospects");
  await expect(page.locator("#selectAllLeads")).toBeVisible();
  await expect(page.locator("th", { hasText: "Email" })).toBeVisible();
  const picks = page.locator(".pick-lead");
  const n = await picks.count();
  expect(n).toBeGreaterThan(0);
  await page.locator("#selectAllLeads").check();
  await expect(page.locator(".check-col input:checked")).toHaveCount(n + 1);
  await expect(page.getByText(n + " SELECTED", { exact: true })).toBeVisible();
  await page.locator("#pickNone").click();
  await expect(page.getByText("SELECT ROWS FOR BULK ACTIONS")).toBeVisible();
  await page.locator("#sortBy").selectOption("name");
  const names = await page.locator("tbody tr td:nth-child(2) .company strong, tbody tr td:nth-child(2) strong").allTextContents();
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  expect(names).toEqual(sorted);
  await page.locator("#sortBy").selectOption("fit");
  await expect(page.locator(".fit-chip").first()).toBeVisible();
});
test("v0.8: bulk approval refuses to invent a contact basis", async ({ page }) => {
  await page.goto("/#prospects");
  await page.locator("#selectAllLeads").check();
  await page.locator("#bulkBasis").fill("");
  page.on("dialog", (d) => d.accept());
  await page.locator("#bulkApprove").click();
  await expect(page.getByText(/Record the contact basis you reviewed/i)).toBeVisible();
  await page.locator("#bulkBasis").fill("Reviewed each business's public contact page; contact relates to their stated business activity.");
  await page.locator("#bulkApprove").click();
  await expect(page.getByText(/record(s)? updated|Bulk action recorded/i).first()).toBeVisible();
});
test("v0.8: mail view keeps every message for the weekly skim, filterable by class", async ({
  page,
}) => {
  await page.goto("/#mail");
  const card = page.locator("section.card", { hasText: "Every message that passed through" }).first();
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Says no / stop" })).toBeVisible();
  await card.getByRole("button", { name: "Out of office" }).click();
  await expect(page.locator("h1")).toBeVisible();
  await card.getByRole("button", { name: "Everything" }).click();
  await expect(card.getByText(/Nothing here was answered/)).toBeVisible();
});
test("v0.8: settings show the global market and who counts as a prospect", async ({
  page,
}) => {
  await page.goto("/#settings");
  const markets = page.locator("section.card", { hasText: "Global markets — all of them" }).first();
  await expect(markets.getByText(/\d+ countries · \d+ cities ready/)).toBeVisible();
  await expect(markets.getByText("NOT 249")).toBeVisible();
  await expect(
    page.locator("section.card", { hasText: "Who counts as a prospect" }).first().getByText("New business", { exact: true }),
  ).toBeVisible();
});
test("v0.8: review queue offers select-all bulk approval of drafts", async ({ page }) => {
  await page.goto("/#review");
  await expect(page.locator("#pickAllDrafts")).toBeVisible();
  await page.locator("#approveBulk").click();
  await expect(page.getByText(/Tick the cards you want approved/)).toBeVisible();
  const cards = await page.locator(".pick-draft:not([disabled])").count();
  if (cards > 0) {
    await page.locator("#pickAllDrafts").click();
    await expect(page.getByText(cards + " SELECTED", { exact: true })).toBeVisible();
    page.on("dialog", (d) => d.accept());
    await page.locator("#approveBulk").click();
    await expect(page.getByText(/approved|Messages approved/i).first()).toBeVisible();
  }
});
test("v0.8: work board sorts, selects and closes tasks in bulk", async ({ page }) => {
  await page.goto("/#tasks");
  await expect(page.locator("#taskSelectAll")).toBeVisible();
  const picks = page.locator(".pick-task");
  const n = await picks.count();
  expect(n).toBeGreaterThan(0);
  await page.locator("#taskPickAll").click();
  await expect(page.getByText(n + " SELECTED", { exact: true })).toBeVisible();
  await page.locator("#taskBulkDone").click();
  await expect(page.getByText(/task\(s\) marked done|Tasks updated/).first()).toBeVisible();
  await page.locator("#taskSort").selectOption("title");
  const titles = await page.locator("tbody tr td:nth-child(2) strong").allTextContents();
  expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
});
test("v0.8: email activity and review queue can be sorted too", async ({ page }) => {
  await page.goto("/#mail");
  await expect(page.locator("#mailSort")).toBeVisible();
  await page.locator("#mailSort").selectOption("subject");
  await expect(page.locator("h1")).toBeVisible();
  await page.goto("/#review");
  await expect(page.locator("#draftSort")).toBeVisible();
  await page.locator("#draftSort").selectOption("status");
  await expect(page.locator("h1")).toBeVisible();
});
test("v0.8: the sidebar names the deployed build so prod can be identified at a glance", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#appVersion")).toHaveText("v0.8.0");
  const r = await page.request.get("/api/version");
  expect(r.ok()).toBeTruthy();
  const b = await r.json();
  expect(b.version).toBe("0.8.0");
  expect(b.features).toContain("bulk-review-with-basis");
  expect(b.markets.cities).toBeGreaterThan(500);
});
