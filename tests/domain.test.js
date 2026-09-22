import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  metrics,
  cohorts,
  target,
  eligible,
  validSettings,
  countryCodes,
  makeDraft,
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
test("auto off requires approval even for opt-in", () =>
  assert.equal(
    eligible(
      { ...lead, consent: "OPT_IN", contactEvidence: "evidence" },
      draft,
      { ...defaults, paused: false },
    ),
    "Waiting for individual approval",
  ));
test("reviewed business basis needs approval in auto mode too", () =>
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
