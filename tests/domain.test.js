import test from "node:test";
import assert from "node:assert/strict";
import { marketSummary, citiesFor, cityFor } from "../src/markets.js";
import {
  defaults,
  metrics,
  cohorts,
  target,
  eligible,
  validSettings,
  countryCodes,
  makeDraft,
  cleanCompanyName,
  isDirectoryName,
  classifyReply,
  EMAIL_STATUS_LABEL,
  emailStatus,
  bestEmail,
} from "../src/domain.js";
import Research from "../src/research.js";
import worker from "../src/worker.js";
import { xlsx } from "../src/xlsx.js";
import fs from "node:fs";
const lead = {
    id: "1",
    email: "owner@example.com",
    consent: "NONE",
    contactEvidence: "",
    status: "APPROVED",
    stage: "NEW",
  },
  draft = { approvedAt: null };
test("global rotation contains 249 unique country/territory codes", () =>
  assert.equal(new Set(countryCodes).size, 249));
test("broad discovers each prospect type within first five queries", () =>
  assert.equal(
    new Set(Array.from({ length: 5 }, (_, i) => target(defaults, i, []).type))
      .size,
    5,
  ));
test("focused mode obeys selected countries/types", () => {
  const s = {
    ...defaults,
    mode: "focused",
    focusCountries: ["BD"],
    focusTypes: ["Freelancer partner"],
  };
  for (let i = 0; i < 20; i++) {
    assert.equal(target(s, i, []).country, "BD");
    assert.equal(target(s, i, []).type, "Freelancer partner");
  }
});
test("all messages pause", () =>
  assert.equal(
    eligible(
      { ...lead, consent: "OPT_IN", contactEvidence: "form optin" },
      draft,
      { ...defaults, autoSendOptIn: true },
    ),
    "System paused",
  ));
test("public email never implies consent", () =>
  assert.notEqual(
    eligible(
      lead,
      { approvedAt: "now", approvedEmail: lead.email },
      { ...defaults, paused: false },
    ),
    null,
  ));
test("auto only sends opted-in contacts", () =>
  assert.equal(
    eligible(
      { ...lead, consent: "OPT_IN", contactEvidence: "form dated consent" },
      draft,
      { ...defaults, paused: false, autoSendOptIn: true },
    ),
    null,
  ));
test("automatic sending is ON by default and can be switched off", () => {
  /* Owner instruction: the auto toggle defaults to on and he can turn it off. */
  assert.equal(defaults.autoSendOptIn, true);
  assert.equal(defaults.autoApprove, true);
  assert.equal(defaults.emailVerify, true);
  assert.equal(
    eligible(
      { ...lead, consent: "OPT_IN", contactEvidence: "evidence" },
      draft,
      { ...defaults, paused: false },
    ),
    null,
    "with the default (on) an opted-in contact sends automatically",
  );
  assert.equal(
    eligible(
      { ...lead, consent: "OPT_IN", contactEvidence: "evidence" },
      draft,
      { ...defaults, paused: false, autoSendOptIn: false },
    ),
    "Waiting for individual approval",
    "switching auto off returns every message to manual review",
  );
  /* A lead that is not yet approved is still never auto-sent. */
  assert.equal(
    eligible(
      { ...lead, status: "UNREVIEWED", consent: "OPT_IN", contactEvidence: "e" },
      draft,
      { ...defaults, paused: false },
    ),
    "Review and approve the source first",
  );
});
test("reviewed business basis stays manual until the autopilot approves it", () =>
  assert.equal(
    eligible(
      { ...lead, consent: "BUSINESS_REVIEWED", contactEvidence: "basis" },
      draft,
      { ...defaults, paused: false, autoSendOptIn: true },
    ),
    "Waiting for individual approval",
  ));
test("individual approved business contact can send with evidence", () =>
  assert.equal(
    eligible(
      {
        ...lead,
        consent: "BUSINESS_REVIEWED",
        contactEvidence: "reviewed basis",
      },
      { approvedAt: "now", approvedEmail: lead.email },
      { ...defaults, paused: false },
    ),
    null,
  ));
test("suppression overrides approval and auto", () =>
  assert.match(
    eligible(
      { ...lead, consent: "OPT_IN", contactEvidence: "yes", suppressed: true },
      { approvedAt: "now", approvedEmail: lead.email },
      { ...defaults, paused: false, autoSendOptIn: true },
    ),
    /Suppressed/,
  ));
test("held source never sends", () =>
  assert.match(
    eligible({ ...lead, status: "HOLD" }, draft, {
      ...defaults,
      paused: false,
    }),
    /hold/,
  ));
test("reply stops automatic follow-up", () =>
  assert.notEqual(
    eligible(
      {
        ...lead,
        consent: "OPT_IN",
        contactEvidence: "yes",
        replyAt: "2026-09-20",
      },
      draft,
      { ...defaults, paused: false, autoSendOptIn: true },
    ),
    null,
  ));
test("recent send stops another automatic draft", () =>
  assert.notEqual(
    eligible(
      {
        ...lead,
        consent: "OPT_IN",
        contactEvidence: "yes",
        lastContactAt: new Date().toISOString(),
      },
      draft,
      { ...defaults, paused: false, autoSendOptIn: true },
    ),
    null,
  ));
test("Won and lost stop automatic messages", () => {
  for (const stage of ["WON", "LOST"])
    assert.notEqual(
      eligible(
        { ...lead, stage, consent: "OPT_IN", contactEvidence: "yes" },
        draft,
        { ...defaults, paused: false, autoSendOptIn: true },
      ),
      null,
    );
});
test("reply denominator excludes uncontacted research", () => {
  const m = metrics([{ firstContactAt: "yes", replyAt: "yes" }, {}, {}, {}]);
  assert.equal(m.replyRate, 100);
  assert.equal(m.contacted, 1);
});
test("won without contact/reply evidence is not a counted customer", () =>
  assert.equal(metrics([{ stage: "WON" }]).won, 0));
test("adaptive stays labelled insufficient under 10 observations", () =>
  assert.equal(cohorts([])[0].evidence, "Insufficient sample"));
test("invalid settings and quota increases rejected", () => {
  for (const x of [
    { dailySendLimit: 100 },
    { dailyTarget: 1000 },
    { mode: "unlimited" },
    { autoSendOptIn: "true" },
    { focusCountries: [] },
  ])
    assert.throws(() => validSettings(x, defaults));
});
test("draft carries no approval", () => {
  const d = makeDraft({ ...lead, niche: "Website & WordPress" }, defaults);
  assert.equal(d.approvedAt, null);
  assert.match(d.body, /not assuming anything is broken/);
});
test("known third-party review sites rejected", () => {
  for (const u of [
    "https://www.trustpilot.com/review/example.com",
    "https://www.checkatrade.com/trades/a",
  ])
    assert.equal(Research.allowed(u), false);
});
test("null paid limit requires owner confirmation and zero paid use", () => {
  const a = {
    current_plan: "Researcher",
    plan_limit: 1000,
    plan_usage: 0,
    paygo_usage: 0,
    paygo_limit: null,
  };
  assert.throws(() => Research.freeUsage({ account: a }, 1));
  assert.equal(Research.freeUsage({ account: a }, 1, true), true);
  assert.throws(() =>
    Research.freeUsage({ account: { ...a, paygo_usage: 1 } }, 1, true),
  );
});
test("production API unauthenticated fails closed", async () => {
  const r = await worker.fetch(new Request("https://app.example/api/state"), {
    DEMO_MODE: "false",
  });
  assert.equal(r.status, 401);
});
test("owner auth setup missing fails closed", async () => {
  const r = await worker.fetch(
    new Request("https://app.example/api/auth/login"),
    { DEMO_MODE: "false" },
  );
  assert.equal(r.status, 400);
});
test("xlsx is generated with literal strings, not formula execution", () => {
  const b = xlsx({
    id: "2026-09-21",
    at: "test",
    counts: { held: 0 },
    target: 50,
    rows: [{ company: '=HYPERLINK("bad")', email: "test@example.com" }],
  });
  assert.equal(new DataView(b.buffer).getUint32(0, true), 0x04034b50);
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/sample.xlsx", b);
  assert.ok(new TextDecoder().decode(b).includes('t="inlineStr"'));
});
test("unreviewed source cannot send even when opt-in is entered", () =>
  assert.equal(
    eligible(
      {
        ...lead,
        status: "UNREVIEWED",
        consent: "OPT_IN",
        contactEvidence: "recorded",
      },
      draft,
      { ...defaults, paused: false, autoSendOptIn: true },
    ),
    "Review and approve the source first",
  ));
test("approval for another recipient is not transferable", () =>
  assert.match(
    eligible(
      { ...lead, consent: "OPT_IN", contactEvidence: "evidence" },
      { approvedAt: "now", approvedEmail: "other@example.com" },
      { ...defaults, paused: false, autoSendOptIn: true },
    ),
    /Recipient changed/,
  ));
import {
  generateContent,
  checkinPlan,
  marketingIdeas,
  businessMap,
} from "../src/domain.js";
const baseSettings = {
  ...defaults,
  skills: ["WordPress / PHP / ACF", "GA4 / GTM / reporting"],
};
test("content generation is deterministic, draft-only and PII-free", () => {
  const a = generateContent("2026-09-21", baseSettings, {
    leads: [],
    campaigns: [],
  });
  const b = generateContent("2026-09-21", baseSettings, {
    leads: [],
    campaigns: [],
  });
  assert.deepEqual(a, b);
  assert.ok(a.length >= 2);
  for (const c of a) {
    assert.equal(c.status, "DRAFT");
    assert.ok(!c.body.includes("@example.com"));
    assert.ok(c.metrics.reach === 0);
  }
  const next = generateContent("2026-09-22", baseSettings, {
    leads: [],
    campaigns: [],
  });
  assert.notEqual(next[0].body, a[0].body);
});
test("content uses owner-recorded win notes, not invented claims", () => {
  const items = generateContent("2026-09-21", baseSettings, {
    leads: [
      {
        stage: "WON",
        replyAt: "2026-09-01",
        notes: "Client recorded: booking form finally works.",
        niche: "E-commerce",
      },
    ],
    campaigns: [{ id: "c1", status: "ACTIVE" }],
  });
  const cs = items.find((x) => x.id.endsWith("-case"));
  assert.ok(cs);
  assert.match(cs.body, /Client recorded: booking form finally works\./);
  assert.equal(cs.campaignId, "c1");
});
test("check-in plan is day 1, 7 and 30", () =>
  assert.deepEqual(
    checkinPlan.map((c) => c.offset),
    [1, 7, 30],
  ));
test("marketing ideas flag backlog, posting gaps and invoice gaps", () => {
  const ideas = marketingIdeas({
    leads: [{ stage: "WON", replyAt: new Date().toISOString() }],
    content: [],
    invoices: [],
    tasks: [1, 2, 3, 4].map((n) => ({ status: "OPEN", due: "2026-01-01" })),
    day: "2026-09-21",
  });
  assert.ok(ideas.some((i) => i.id === "clear-backlog"));
  assert.ok(ideas.some((i) => i.id === "publish"));
  assert.ok(ideas.some((i) => i.id === "invoices"));
});
test("business map covers the full A-to-Z lifecycle", () => {
  assert.ok(businessMap.length >= 15);
  const statuses = businessMap.map((r) => r.status);
  assert.ok(statuses.includes("NOT FREE"));
  assert.ok(statuses.includes("NEEDS DATA"));
  assert.ok(businessMap.every((r) => r.stage && r.people && r.note));
});

import { parseTopics, contentFromConcept } from "../src/domain.js";

test("parseTopics handles plain lines and ID: topic lines", () => {
  assert.deepEqual(parseTopics({ contentTopics: "" }), []);
  const t = parseTopics({
    contentTopics:
      "GA4 for clinics\nT2: WordPress maintenance plans\n\n   \nReporting dashboards",
  });
  assert.equal(t.length, 3);
  assert.equal(t[0].id, null);
  assert.equal(t[0].topic, "GA4 for clinics");
  assert.equal(t[1].id, "T2");
  assert.equal(t[1].topic, "WordPress maintenance plans");
  assert.equal(t[2].topic, "Reporting dashboards");
});

test("generateContent honors owner topics and quantity, deterministically", () => {
  const s = {
    ...baseSettings,
    contentTopics: "Alpha: enquiries\nBeta: dashboards\nGamma: automation",
    contentCount: 4,
  };
  const a = generateContent("2026-09-22", s, { leads: [], campaigns: [] });
  const b = generateContent("2026-09-22", s, { leads: [], campaigns: [] });
  assert.deepEqual(a, b);
  assert.equal(a.length, 4);
  assert.equal(new Set(a.map((x) => x.id)).size, 4);
  assert.equal(new Set(a.map((x) => x.topic)).size, 3);
  for (const c of a) {
    assert.equal(c.status, "DRAFT");
    assert.equal(c.source, "autopilot");
    assert.ok(c.body.length > 100);
  }
});

test("concept writer embeds concept, skill and portfolio without invented claims", () => {
  const body = contentFromConcept(
    "Why clinics lose after-hours enquiries",
    baseSettings,
    "LinkedIn post",
  );
  assert.match(body, /Why clinics lose after-hours enquiries/);
  assert.match(body, /ga4 \/ gtm \/ reporting|wordpress \/ php \/ acf/i);
  assert.match(body, /Portfolio: https:\/\/fozayelibnayaz\.github\.io\/portfolio\//);
  const x = contentFromConcept("Same topic", baseSettings, "X post");
  assert.ok(!x.includes("Portfolio:"));
});

test("autopilot settings validate ranges and types", () => {
  const s = validSettings(
    {
      contentCount: 5,
      contentTopics: "A: one\nB: two",
      contentAi: true,
      autoReplyWatch: false,
    },
    defaults,
  );
  assert.equal(s.contentCount, 5);
  assert.equal(s.contentTopics, "A: one\nB: two");
  assert.equal(s.contentAi, true);
  assert.equal(s.autoReplyWatch, false);
  assert.throws(() => validSettings({ contentCount: 0 }, defaults));
  assert.throws(() => validSettings({ contentCount: 11 }, defaults));
  assert.throws(() =>
    validSettings({ contentTopics: "x".repeat(1201) }, defaults),
  );
  assert.throws(() => validSettings({ contentAi: "yes" }, defaults));
});

import { makeFollowup } from "../src/domain.js";

test("follow-up copy is honest, threaded and stops on request", () => {
  const lead = { id: "l1", company: "Northline", niche: "Website & WordPress" };
  const f = makeFollowup(lead, baseSettings, 4, "Would website support be relevant?");
  assert.equal(f.kind, "followup");
  assert.match(f.subject, /^Re: Would website support/);
  assert.equal(f.status, "DRAFT");
  assert.equal(f.approvedAt, null);
  assert.match(f.body, /wrote 4 days ago/);
  assert.match(f.body, /will close the file for good/);
  assert.match(f.body, /Portfolio: https:\/\/fozayelibnayaz\.github\.io\/portfolio\//);
  assert.ok(
    !/\d+%|guarantee|guaranteed|clients? (got|increased)|\d+ (leads|customers|sales)/i.test(
      f.body,
    ),
  );
  const again = makeFollowup(lead, baseSettings, 4, "Re: already threaded");
  assert.equal(again.subject, "Re: already threaded");
});

test("follow-up settings validate ranges and types", () => {
  const s = validSettings({ followUpOn: false, followUpDays: 7, followUpMax: 2 }, defaults);
  assert.equal(s.followUpOn, false);
  assert.equal(s.followUpDays, 7);
  assert.equal(s.followUpMax, 2);
  assert.throws(() => validSettings({ followUpDays: 1 }, defaults));
  assert.throws(() => validSettings({ followUpDays: 15 }, defaults));
  assert.throws(() => validSettings({ followUpMax: 3 }, defaults));
  assert.throws(() => validSettings({ followUpOn: "yes" }, defaults));
});

test("multi-sheet xlsx export produces a real workbook", async () => {
  const { xlsxBook } = await import("../src/xlsx.js");
  const buf = xlsxBook([
    { name: "Sent", header: ["When", "Business"], rows: [["2026-09-22", "Northline"]] },
    { name: "Received", header: ["When", "From"], rows: [["2026-09-22", "test@example.com"]] },
  ]);
  assert.ok(buf instanceof Uint8Array || buf instanceof ArrayBuffer);
  const bytes = new Uint8Array(buf);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.ok(bytes.length > 500);
});

import { parsePauseWindows, inPauseWindow, makeInvoiceReminder } from "../src/domain.js";

test("pause windows parse, validate and match correctly", () => {
  assert.deepEqual(parsePauseWindows(""), []);
  assert.deepEqual(parsePauseWindows("2026-12-20..2027-01-03"), [
    { from: "2026-12-20", to: "2027-01-03" },
  ]);
  assert.deepEqual(parsePauseWindows("2026-12-25"), [
    { from: "2026-12-25", to: "2026-12-25" },
  ]);
  assert.throws(() => parsePauseWindows("20-12-2026"));
  assert.throws(() => parsePauseWindows("2027-01-03..2026-12-20"));
  assert.throws(() => parsePauseWindows("nonsense line"));
  const s = { ...defaults, pauseWindows: "2026-12-20..2027-01-03\n2027-06-01" };
  assert.deepEqual(inPauseWindow(s, "2026-12-25"), { from: "2026-12-20", to: "2027-01-03" });
  assert.deepEqual(inPauseWindow(s, "2027-06-01"), { from: "2027-06-01", to: "2027-06-01" });
  assert.equal(inPauseWindow(s, "2026-11-30"), null);
  assert.equal(inPauseWindow(s, "2027-01-04"), null);
  assert.equal(inPauseWindow({ ...defaults, pauseWindows: "broken" }, "2027-01-04"), null);
});

test("pause window settings validate through validSettings", () => {
  const s = validSettings({ pauseWindows: "2026-12-20..2027-01-03" }, defaults);
  assert.match(s.pauseWindows, /2026-12-20/);
  assert.throws(() => validSettings({ pauseWindows: "yesterday" }, defaults));
  assert.throws(() => validSettings({ invoiceRemindersOn: "yes" }, defaults));
});

test("second follow-up angle is distinct, final and claim-free", () => {
  const lead = { id: "l1", company: "Northline", niche: "Website & WordPress" };
  const first = makeFollowup(lead, baseSettings, 4, "Intro", 1);
  const second = makeFollowup(lead, baseSettings, 4, "Intro", 2);
  assert.notEqual(first.body, second.body);
  assert.match(second.body, /last message from me/i);
  assert.match(second.body, /close the file/i);
  assert.match(second.body, /No follow-up will be sent automatically/i);
  for (const f of [first, second]) {
    assert.equal(f.status, "DRAFT");
    assert.equal(f.approvedAt, null);
    assert.ok(!/\d+%|guarantee|clients? (got|increased)/i.test(f.body));
  }
});

test("invoice reminder copy is factual and pressure-free", () => {
  const lead = { id: "l1", company: "Won Co" };
  const inv = { id: "inv1", amount: 15000, currency: "USD", dueAt: "2026-09-01" };
  const d = makeInvoiceReminder(lead, inv, baseSettings);
  assert.equal(d.kind, "invoice-reminder");
  assert.equal(d.invoiceId, "inv1");
  assert.equal(d.status, "DRAFT");
  assert.match(d.subject, /15,000 USD/);
  assert.match(d.subject, /2026-09-01/);
  assert.match(d.body, /already paid, please ignore/i);
  assert.match(d.body, /different arrangement/i);
  assert.ok(!/late fee|legal action|immediately|urgent/i.test(d.body));
});

import {
  urgentScore,
  fitScore,
  launchPlan,
  goalPace,
  healthCheck,
  PLAYBOOK,
  CONTENT_STARTERS,
  makeLocalizedDraft,
} from "../src/domain.js";

test("urgent rules catch call requests, phone numbers and plain highs", () => {
  const u = urgentScore("Please call now, we need it today.");
  assert.equal(u.tier, "URGENT");
  assert.ok(u.hits.includes("call now"));
  assert.equal(urgentScore("Reach me on +44 7700 900123 anytime").tier, "URGENT");
  assert.equal(urgentScore("Happy to meet next week and discuss the proposal").tier, "HIGH");
  assert.equal(urgentScore("Thanks, noted. No rush.").tier, null);
  const custom = urgentScore("quoting please, ready to sign", "ready to sign, quoting please");
  assert.equal(custom.tier, "URGENT");
  assert.ok(custom.hits.includes("ready to sign"));
});

test("urgent keywords are bounded and validated through settings", () => {
  assert.throws(() => validSettings({ urgentWords: "x".repeat(501) }), /Urgent keywords/);
  assert.throws(() => validSettings({ urgentWords: 42 }), /Urgent keywords/);
  assert.equal(validSettings({ urgentWords: " call now , rush " }).urgentWords, "call now , rush");
  assert.throws(() => validSettings({ language: "fr" }), /language/i);
  assert.equal(validSettings({ language: "bn" }).language, "bn");
  for (const k of ["goalRevenue", "goalCustomers"]) {
    assert.throws(() => validSettings({ [k]: -1 }), /goal/i);
    assert.throws(() => validSettings({ [k]: 100000001 }), /goal/i);
    assert.throws(() => validSettings({ [k]: "500" }), /goal/i);
    assert.equal(validSettings({ [k]: 500 })[k], 500);
  }
  assert.equal(validSettings({ urgentAi: true }).urgentAi, true);
  assert.equal(validSettings({ watchAllInbox: true }).watchAllInbox, true);
  assert.equal(defaults.urgentWatch, true);
  assert.equal(defaults.urgentAi, false);
  assert.equal(defaults.watchAllInbox, false);
  assert.equal(defaults.language, "en");
});

test("fit score is transparent, bounded and lists its reasons", () => {
  const weak = fitScore({
    platform: "wix",
    analytics: false,
    hiringSignal: true,
    socials: {},
    website: "http://example.com",
  });
  const guarded = fitScore({ platform: "wix", analytics: false, suppressed: true, socials: {} });
  assert.ok(weak.score > guarded.score);
  assert.ok(weak.score <= 100 && weak.score >= 0);
  assert.ok(weak.reasons.length > 0 && weak.reasons.length <= 6);
  assert.ok(weak.reasons.some((r) => /wix/i.test(r)));
  const none = fitScore({});
  assert.ok(none.score >= 0 && none.score <= 100);
});

test("Bangla drafts use the built-in templates and never leave a blank body", () => {
  const bnLead = { id: "b1", company: "ঢাকা ট্রেডার্স", website: "https://x.example", niche: "ওয়েবসাইট" };
  const d = makeLocalizedDraft(bnLead, baseSettings, "outreach", "bn");
  assert.equal(d.language, "bn");
  assert.ok(/[\u0980-\u09FF]/.test(d.body));
  assert.ok(!/\{owner\}|\{niche\}|\{portfolio\}/.test(d.body));
  assert.match(d.body, /audit/i.test(d.body) ? /./ : /অডিট/);
  const en = makeLocalizedDraft(bnLead, baseSettings, "outreach", "en");
  assert.notEqual(en.body, d.body);
  assert.ok(en.body.length > 50);
  const checkin = makeLocalizedDraft(bnLead, baseSettings, "checkin", "bn");
  assert.ok(/[\u0980-\u09FF]/.test(checkin.body));
  const welcome = makeLocalizedDraft(bnLead, baseSettings, "welcome", "bn");
  assert.ok(/[\u0980-\u09FF]/.test(welcome.body));
});

test("launch plan is dated, ordered and honest", () => {
  const plan = launchPlan({ offer: "websites", audience: "cafes", price: "300 USD", city: "Dhaka", hours: "20" });
  assert.ok(plan.length >= 10);
  assert.deepEqual(plan.map((p) => p.id)[0], "plan-1");
  const dates = plan.map((p) => p.due);
  assert.deepEqual([...dates].sort(), dates);
  assert.ok(plan.every((p) => p.status === "OPEN" && p.due && p.title));
  assert.ok(!plan.some((p) => /guarantee|viral|10x/i.test(p.note + p.title)));
  assert.match(JSON.stringify(plan), /cafes|websites/);
});

test("goal pace compares the month so far with the pro-rata target", () => {
  const settings = { ...baseSettings, goalRevenue: 30000, goalCustomers: 3 };
  const r = goalPace({
    settings,
    leads: [{ stage: "WON", replyAt: "2026-09-05T00:00:00Z" }],
    invoices: [
      { status: "PAID", amount: 9000, paidAt: "2026-09-10" },
      { status: "SENT", amount: 5000, dueAt: "2026-09-20" },
    ],
    dayISO: "2026-09-15",
  });
  assert.equal(r.paidThisMonth, 9000);
  assert.equal(r.wonThisMonth, 1);
  assert.equal(r.pace.revenue.target, 30000);
  assert.equal(r.pace.revenue.soFar, 9000);
  assert.equal(r.pace.revenue.expected, 15000);
  assert.equal(r.pace.daysInMonth, 30);
  const none = goalPace({ settings: baseSettings, leads: [], invoices: [], dayISO: "2026-09-15" });
  assert.equal(none.pace, null);
});

test("health check points at money and replies first and never invents data", () => {
  const items = healthCheck({
    leads: [{ stage: "REPLIED" }],
    invoices: [{ id: "i1", status: "SENT", dueAt: "2026-09-01" }],
    tasks: [{ status: "OPEN", due: "2026-09-02" }],
    content: [],
    day: "2026-09-15",
  });
  assert.ok(items.some((x) => /invoice/i.test(x.text)));
  assert.ok(items.some((x) => /answer|conversation/i.test(x.text)));
  assert.ok(items.every((x) => typeof x.text === "string" && x.text.length > 10));
  const calm = healthCheck({ leads: [], invoices: [], tasks: [], content: [], day: "2026-09-15" });
  assert.ok(calm.some((x) => /Nothing posted|Nothing/i.test(x.text)));
  assert.ok(PLAYBOOK.length >= 10 && CONTENT_STARTERS.length >= 5);
  assert.ok(PLAYBOOK.every((p) => p.en && p.bn));
  assert.ok(CONTENT_STARTERS.every((c) => c.en && c.bn));
});

import { journey, journeyStep, JOURNEY } from "../src/domain.js";

test("journey counts real steps only and never invents progress", () => {
  const leads = [
    { id: "a", company: "Fresh", status: "UNREVIEWED", stage: "NEW" },
    { id: "b", company: "Reviewed", status: "APPROVED", stage: "NEW" },
    { id: "c", company: "Talked", status: "APPROVED", stage: "REPLIED", firstContactAt: "2026-09-01", replyAt: "2026-09-02" },
    { id: "d", company: "Won Co", status: "APPROVED", stage: "WON", firstContactAt: "2026-08-01", replyAt: "2026-08-02", quote: 5000 },
  ];
  const invoices = [
    { id: "i1", leadId: "d", status: "SENT", amount: 5000 },
    { id: "i2", leadId: "d", status: "PAID", amount: 5000 },
  ];
  const j = journey(leads, invoices);
  assert.deepEqual(
    j.steps.map((s) => s.id),
    JOURNEY.map((s) => s.id),
  );
  assert.equal(j.found, 4);
  assert.equal(j.steps.find((s) => s.id === "REVIEWED").count, 3);
  assert.equal(j.steps.find((s) => s.id === "REPLIED").count, 2);
  assert.equal(j.steps.find((s) => s.id === "WON").count, 1);
  assert.equal(j.converted, 1);
  assert.equal(j.steps.find((s) => s.id === "PAID").count, 1);
  assert.equal(journeyStep({ status: "UNREVIEWED", stage: "NEW" }, []).id, "FOUND");
  assert.equal(journeyStep(leads[3], invoices).id, "PAID");
  assert.equal(journeyStep(leads[3], [{ leadId: "d", status: "SENT" }]).id, "INVOICED");
  assert.ok(j.perLead.length >= 3);
  assert.ok(j.perLead.every((x) => typeof x.stepLabel === "string" && x.stepLabel.length > 0));
  assert.equal(j.perLead[0].company, "Won Co");
  assert.equal(journeyStep({ id: "x", status: "UNREVIEWED", stage: "NEW" }, [{ leadId: "x", status: "SENT" }]).id, "INVOICED");
});

/* --- v0.8: professional, research-grounded drafts ------------------------- */
test("outreach draft opens with something actually found in research", () => {
  const l = {
    ...lead,
    company: "Aroma Coffee House",
    niche: "website & wordpress",
    platform: "wordpress",
    analytics: false,
    type: "New business",
    cityLabel: "Khulna",
  };
  const d = makeLocalizedDraft(l, defaults, "outreach", "en");
  assert.equal(d.grounded, true);
  assert.match(d.body, /While looking at Aroma Coffee House's website/);
  assert.match(d.body, /built on WordPress/);
  assert.match(d.body, /not assuming anything is broken/);
  assert.match(d.body, /first months in Khulna/);
  assert.match(d.subject, /WordPress/);
  assert.doesNotMatch(d.body, /\[|\{\{|TODO|Lorem/i, "no template placeholders leak into the letter");
});
test("a lead with nothing to quote gets an honest letter, not a fake compliment", () => {
  const d = makeLocalizedDraft({ ...lead, company: "Quiet Co" }, defaults, "outreach", "en");
  assert.equal(d.grounded, false);
  assert.equal(d.observation, "");
  assert.doesNotMatch(d.body, /While looking at/);
  assert.match(d.body, /Would a short, specific example/);
});
test("follow-up keeps the same observation and asks for a clear no", () => {
  const l = { ...lead, company: "Aroma", analytics: false };
  const f = makeLocalizedDraft(l, defaults, "followup", "en");
  assert.match(f.body, /One short follow-up/);
  assert.match(f.body, /one-word no is completely fine/);
  assert.match(f.body, /Portfolio:/);
});
test("directory titles are stripped back to the real business name", () => {
  assert.equal(cleanCompanyName("Connect companies | CommissionCrowd", "https://www.commissioncrowd.com/x"), "Connect companies");
  assert.equal(cleanCompanyName("Acme Joinery — Home", "https://acmejoinery.co.uk"), "Acme Joinery");
  assert.equal(cleanCompanyName("Bella's Bakery | Facebook", "https://facebook.com/bellas"), "Bella's Bakery");
  assert.equal(isDirectoryName("Top 10 agencies in Manchester", "https://www.semrush.com/company/acme"), true);
  assert.equal(isDirectoryName("Acme Joinery", "https://acmejoinery.co.uk"), false);
});
test("reply classification names the words it matched, and content beats a forward", () => {
  const urgent = classifyReply("Please call now — we want to sign this week", { subject: "Re: hello" });
  assert.equal(urgent.class, "INTERESTED");
  assert.equal(urgent.tier, "URGENT");
  assert.ok(urgent.hits.length >= 1);
  const no = classifyReply("Not interested, please don't call again", { subject: "Re: hello" });
  assert.equal(no.class, "NEGATIVE");
  const ooo = classifyReply("I am away until Monday", { subject: "Re: hi" });
  assert.equal(ooo.class, "OFFICE");
  const fwd = classifyReply("See below", { subject: "Fwd: hello" });
  assert.equal(fwd.class, "FORWARD");
  const interest = classifyReply("Please call now", { subject: "Fwd: hello" });
  assert.equal(interest.class, "INTERESTED", "real interest is never hidden behind a forward");
});
test("every email verdict says what it can and cannot prove", () => {
  assert.match(EMAIL_STATUS_LABEL.MX_OK, /not a delivery proof/i);
  assert.equal(emailStatus("owner@example.com", true), "MX_OK");
  assert.equal(emailStatus("info@example.com", true), "MX_OK_ROLE");
  assert.equal(emailStatus("owner@example.com"), "SYNTAX_OK");
  assert.equal(emailStatus("owner@example.com", false), "NO_MAIL_SERVER");
  assert.equal(emailStatus("bad@mailinator.com", true), "DISPOSABLE");
  assert.equal(emailStatus("not-an-email", true), "INVALID_SYNTAX");
  assert.equal(bestEmail([{ email: "info@a.com", status: "MX_OK_ROLE" }, { email: "rakib@a.com", status: "MX_OK" }]).email, "rakib@a.com");
});
test("markets cover the world, with real cities inside each country", () => {
  assert.ok(marketSummary.countries >= 120, "countries: " + marketSummary.countries);
  assert.ok(marketSummary.cities >= 500, "cities: " + marketSummary.cities);
  assert.ok(citiesFor("BD").includes("Khulna"));
  assert.equal(cityFor("BD", 3), "Khulna");
  assert.ok(cityFor("US", 5).length > 2);
});
