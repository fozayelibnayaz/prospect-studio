import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { Miniflare } from "miniflare";
const origin = "https://studio.example",
  session = "testsession",
  secret = "a".repeat(40);
async function setup({
  paid = false,
  mailFailure = false,
  identity = "owner@example.com",
  replies = [],
} = {}) {
  let calls = [];
  const mf = new Miniflare({
    modules: true,
    modulesRules: [{ type: "ESModule", include: ["**/*.js"] }],
    scriptPath: new URL("../src/worker.js", import.meta.url).pathname,
    compatibilityDate: "2026-04-01",
    d1Databases: ["DB"],
    bindings: {
      DEMO_MODE: "false",
      APP_ORIGIN: origin,
      OWNER_EMAIL: "owner@example.com",
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
      ENCRYPTION_KEY: secret,
      TAVILY_API_KEY: "test-key",
      TAVILY_PAYGO_DISABLED_CONFIRMED: "true",
    },
    outboundService: async (r) => {
      calls.push(r.url);
      const u = r.url;
      const send = (x) =>
        new Response(JSON.stringify(x), {
          headers: { "Content-Type": "application/json" },
        });
      if (u === "https://api.tavily.com/usage")
        return send({
          account: {
            current_plan: paid ? "Bootstrap" : "Researcher",
            plan_usage: 0,
            plan_limit: paid ? 15000 : 1000,
            paygo_usage: 0,
            paygo_limit: null,
          },
        });
      if (u === "https://api.tavily.com/search")
        return send({
          results: [
            { url: "https://artisan.example.org/", title: "Artisan services" },
          ],
        });
      if (u === "https://api.tavily.com/extract") {
        const b = await r.json();
        return send({
          results: b.urls.map((url) => ({
            url,
            raw_content:
              "Our company provides business services in the United Kingdom. Contact info@artisan.example.org. [Contact](https://artisan.example.org/contact)",
          })),
          failed_results: [],
        });
      }
      if (u === "https://openidconnect.googleapis.com/v1/userinfo")
        return send({ email: identity, email_verified: true });
      if (u === "https://oauth2.googleapis.com/token")
        return send({ access_token: "access" });
      if (u.endsWith("/messages/send"))
        return mailFailure
          ? new Response("failure", { status: 500 })
          : send({ id: "gmail-1", threadId: "thread-1" });
      if (u.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/messages?"))
        return send({
          messages: replies.map((r) => ({ id: r.id, threadId: r.threadId })),
        });
      if (u.includes("gmail.googleapis.com/gmail/v1/users/me/messages/")) {
        const mid = u.split("/messages/")[1].split("?")[0];
        const r = replies.find((x) => x.id === mid);
        if (!r) throw Error("Unexpected gmail message fetch " + u);
        return send({
          id: r.id,
          threadId: r.threadId,
          internalDate: String(r.internalDate ?? Date.now()),
          snippet: String(r.body || "").slice(0, 100),
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: r.from },
              { name: "Subject", value: r.subject || "Re: Test subject" },
              ...(r.autoSubmitted
                ? [{ name: "Auto-Submitted", value: "auto-replied" }]
                : []),
            ],
            body: { data: Buffer.from(String(r.body || "")).toString("base64url") },
          },
        });
      }
      throw Error("Unexpected external call " + u);
    },
  });
  const db = await mf.getD1Database("DB").catch(async (err) => {
    await mf.dispose();
    throw err;
  });
  for (const sql of fs
    .readFileSync(new URL("../migrations/0001.sql", import.meta.url), "utf8")
    .split(";")
    .filter((x) => x.trim()))
    await db.prepare(sql).run();
  await db
    .prepare("INSERT INTO sessions(id,expires) VALUES(?,?)")
    .bind(
      crypto.createHash("sha256").update(session).digest("hex"),
      Date.now() + 600000,
    )
    .run();
  async function put(k, id, data) {
    await db
      .prepare(
        "INSERT INTO objects(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
      )
      .bind(k, id, JSON.stringify(data))
      .run();
  }
  await put("settings", "main", { paused: false, autoSendOptIn: false });
  async function action(body) {
    const r = await mf.dispatchFetch(origin + "/api/action", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: "ps_session=" + session,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  }
  async function get(k, id) {
    const r = await db
      .prepare("SELECT data FROM objects WHERE kind=? AND id=?")
      .bind(k, id)
      .first();
    return r && JSON.parse(r.data);
  }
  return { mf, db, calls, put, get, action };
}
async function mailFixture(h) {
  const iv = crypto.randomBytes(12),
    key = crypto.createHash("sha256").update(secret).digest(),
    cipher = crypto.createCipheriv("aes-256-gcm", key, iv),
    encrypted = Buffer.concat([
      iv,
      cipher.update("refresh-token"),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString("base64");
  await h.put("credentials", "gmail", { encrypted });
  await h.put("leads", "l1", {
    id: "l1",
    company: "Test business",
    email: "test@example.com",
    consent: "OPT_IN",
    contactEvidence: "Explicit fixture consent",
    status: "APPROVED",
    stage: "NEW",
  });
  await h.put("drafts", "d1", {
    id: "d1",
    leadId: "l1",
    status: "APPROVED",
    approvedAt: new Date().toISOString(),
    approvedEmail: "test@example.com",
    subject: "Test subject",
    body: "Test message",
  });
}
test("real D1 adapter: source calls reserve quota, enrich and deduplicate", async () => {
  const h = await setup();
  try {
    let r = await h.action({ action: "discover" });
    assert.equal(r.status, 200, JSON.stringify(r));
    r = await h.action({ action: "discover" });
    assert.equal(r.status, 200, JSON.stringify(r));
    const rows = await h.db
      .prepare("SELECT data FROM objects WHERE kind='leads'")
      .all();
    assert.equal(rows.results.length, 1);
    const lead = JSON.parse(rows.results[0].data);
    assert.equal(lead.consent, "NONE");
    assert.equal(lead.sourceKind, "DISCOVERY");
    assert.ok(h.calls.some((x) => x.endsWith("/usage")));
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: paid plan stops before search or extraction", async () => {
  const h = await setup({ paid: true });
  try {
    const r = await h.action({ action: "discover" });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /FREE_PLAN_NOT_VERIFIED/);
    assert.equal(
      h.calls.filter((x) => x.endsWith("/search") || x.endsWith("/extract"))
        .length,
      0,
    );
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: ambiguous send becomes UNKNOWN and is not retried", async () => {
  const h = await setup({ mailFailure: true });
  try {
    await mailFixture(h);
    const r = await h.action({ action: "send" });
    assert.equal(r.status, 400);
    assert.equal((await h.get("drafts", "d1")).status, "UNKNOWN");
    await h.action({ action: "send" });
    assert.equal(h.calls.filter((x) => x.endsWith("/messages/send")).length, 1);
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: successful approved send records one attempt and a follow-up task", async () => {
  const h = await setup();
  try {
    await mailFixture(h);
    const r = await h.action({ action: "send" });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal((await h.get("drafts", "d1")).status, "SENT");
    assert.ok((await h.get("leads", "l1")).firstContactAt);
    assert.ok(await h.get("tasks", "followup-d1"));
    await h.action({ action: "send" });
    assert.equal(h.calls.filter((x) => x.endsWith("/messages/send")).length, 1);
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: global pause and suppression stop sends", async () => {
  const h = await setup();
  try {
    await mailFixture(h);
    await h.action({ action: "settings", value: { paused: true } });
    await h.action({ action: "send" });
    assert.equal(h.calls.length, 0);
    await h.action({ action: "settings", value: { paused: false } });
    await h.action({ action: "lead", id: "l1", value: { suppressed: true } });
    await h.action({ action: "send" });
    assert.equal(h.calls.length, 0);
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: suppression is reversible via restore, consent must be re-recorded", async () => {
  const h = await setup();
  try {
    await mailFixture(h);
    await h.action({ action: "lead", id: "l1", value: { suppressed: true } });
    assert.equal((await h.get("leads", "l1")).suppressed, true);
    // Ordinary edits must NOT re-enable a suppressed lead (sticky safety).
    await h.action({ action: "lead", id: "l1", value: { notes: "just editing" } });
    assert.equal((await h.get("leads", "l1")).suppressed, true);
    // Explicit restore clears the flag and the suppression entry.
    await h.action({ action: "lead", id: "l1", value: { suppressed: false } });
    assert.equal((await h.get("leads", "l1")).suppressed, false);
    assert.equal(
      await h.get(
        "suppression",
        crypto.createHash("sha256").update("test@example.com").digest("hex"),
      ),
      null,
    );
    // Still no send: suppression cleared consent, so a new basis is required.
    await h.action({ action: "send" });
    assert.equal(
      h.calls.filter((x) => x.endsWith("/messages/send")).length,
      0,
    );
    await h.action({
      action: "lead",
      id: "l1",
      value: { contactEvidence: "Re-recorded after restore", consent: "OPT_IN" },
    });
    await h.action({ action: "send" });
    assert.equal(
      h.calls.filter((x) => x.endsWith("/messages/send")).length,
      1,
    );
    // Restoring a contact that is not suppressed is rejected.
    const again = await h.action({
      action: "lead",
      id: "l1",
      value: { suppressed: false },
    });
    assert.equal(again.status, 400);
    assert.match(again.body.error, /not currently suppressed/);
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: missing session and cross-origin writes rejected", async () => {
  const h = await setup();
  try {
    const r = await h.mf.dispatchFetch(origin + "/api/state");
    assert.equal(r.status, 401);
    const x = await h.mf.dispatchFetch(origin + "/api/action", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        Cookie: "ps_session=" + session,
      },
      body: JSON.stringify({ action: "send" }),
    });
    assert.equal(x.status, 403);
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: opt-out address remains blocked even if a lead record is later reimported", async () => {
  const h = await setup();
  try {
    await mailFixture(h);
    await h.put(
      "suppression",
      crypto.createHash("sha256").update("test@example.com").digest("hex"),
      { at: new Date().toISOString() },
    );
    await h.action({ action: "send" });
    assert.equal(h.calls.filter((x) => x.endsWith("/messages/send")).length, 0);
  } finally {
    await h.mf.dispose();
  }
});
test("OAuth mock: owner callback creates a secure session and state cannot be replayed", async () => {
  const h = await setup();
  try {
    const start = await h.mf.dispatchFetch(origin + "/api/auth/login", {
      redirect: "manual",
    });
    assert.equal(start.status, 302);
    const state = new URL(start.headers.get("Location")).searchParams.get(
      "state",
    );
    const callback =
      origin + "/api/auth/callback?state=" + state + "&code=fixture";
    const response = await h.mf.dispatchFetch(callback, {
      redirect: "manual",
      headers: { Cookie: "ps_state=" + state },
    });
    assert.equal(response.status, 302);
    assert.match(
      response.headers.get("Set-Cookie"),
      /ps_session=.*HttpOnly; Secure; SameSite=Lax/,
    );
    const replay = await h.mf.dispatchFetch(callback, {
      redirect: "manual",
      headers: { Cookie: "ps_state=" + state },
    });
    assert.equal(replay.status, 400);
  } finally {
    await h.mf.dispose();
  }
});
test("OAuth mock: another verified Google account is denied", async () => {
  const h = await setup({ identity: "intruder@example.com" });
  try {
    const start = await h.mf.dispatchFetch(origin + "/api/auth/login", {
      redirect: "manual",
    });
    const state = new URL(start.headers.get("Location")).searchParams.get(
      "state",
    );
    const response = await h.mf.dispatchFetch(
      origin + "/api/auth/callback?state=" + state + "&code=fixture",
      { redirect: "manual", headers: { Cookie: "ps_state=" + state } },
    );
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Only the configured owner/);
    assert.equal(response.headers.get("Set-Cookie"), null);
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: WON creates check-in schedule, welcome draft and invoice", async () => {
  const h = await setup();
  try {
    await h.put("leads", "l1", {
      id: "l1",
      company: "Win Co",
      email: "win@example.com",
      consent: "NONE",
      contactEvidence: "",
      status: "APPROVED",
      stage: "REPLIED",
      firstContactAt: new Date().toISOString(),
      replyAt: new Date().toISOString(),
    });
    const r = await h.action({
      action: "lead",
      id: "l1",
      value: { stage: "WON", invoiceAmount: 900, invoiceCurrency: "USD" },
    });
    assert.equal(r.status, 200, JSON.stringify(r));
    const tasks = (
      await h.db.prepare("SELECT data FROM objects WHERE kind='tasks'").all()
    ).results.map((x) => JSON.parse(x.data));
    assert.ok(tasks.some((t) => t.title.includes("First-week check-in")));
    assert.ok(tasks.some((t) => t.type === "RENEWAL"));
    assert.ok(tasks.some((t) => t.type === "ONBOARDING"));
    const drafts = (
      await h.db.prepare("SELECT data FROM objects WHERE kind='drafts'").all()
    ).results.map((x) => JSON.parse(x.data));
    assert.ok(drafts.some((d) => d.kind === "welcome" && d.status === "DRAFT"));
    const inv = (
      await h.db.prepare("SELECT data FROM objects WHERE kind='invoices'").all()
    ).results.map((x) => JSON.parse(x.data));
    assert.equal(inv.length, 1);
    assert.equal(inv[0].amount, 900);
    assert.equal(inv[0].status, "DRAFT");
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: WON without reply evidence and LOST without reason are rejected", async () => {
  const h = await setup();
  try {
    await h.put("leads", "l1", {
      id: "l1",
      company: "No Reply Co",
      email: "n@example.com",
      consent: "NONE",
      contactEvidence: "",
      status: "APPROVED",
      stage: "CONTACTED",
      firstContactAt: new Date().toISOString(),
    });
    assert.equal(
      (await h.action({ action: "lead", id: "l1", value: { stage: "WON" } }))
        .status,
      400,
    );
    const r2 = await h.action({
      action: "lead",
      id: "l1",
      value: { stage: "LOST" },
    });
    assert.equal(r2.status, 400);
    assert.match(r2.body.error, /loss reason/);
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: content generation is idempotent per day", async () => {
  const h = await setup();
  try {
    const a = await h.action({ action: "generateContent" });
    assert.equal(a.status, 200);
    const b = await h.action({ action: "generateContent" });
    assert.equal(b.body.skipped, "already-generated");
    const rows = (
      await h.db.prepare("SELECT data FROM objects WHERE kind='content'").all()
    ).results;
    assert.equal(rows.length, a.body.generated);
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: invoice payment is recorded once and locked", async () => {
  const h = await setup();
  try {
    await h.put("leads", "l1", {
      id: "l1",
      company: "Pay Co",
      email: "p@example.com",
      consent: "NONE",
      contactEvidence: "",
      status: "APPROVED",
      stage: "REPLIED",
      firstContactAt: new Date().toISOString(),
      replyAt: new Date().toISOString(),
    });
    await h.action({
      action: "lead",
      id: "l1",
      value: { stage: "WON", invoiceAmount: 100 },
    });
    const id = (
      await h.db.prepare("SELECT id FROM objects WHERE kind='invoices'").all()
    ).results[0].id;
    const r = await h.action({
      action: "invoice",
      id,
      value: { status: "PAID" },
    });
    assert.equal(r.status, 200);
    assert.equal((await h.get("invoices", id)).status, "PAID");
    const locked = await h.action({
      action: "invoice",
      id,
      value: { amount: 50 },
    });
    assert.equal(locked.status, 400);
  } finally {
    await h.mf.dispose();
  }
});
test("real D1 adapter: weekly digest builds with customers and ideas", async () => {
  const h = await setup();
  try {
    const r = await h.action({ action: "digest" });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.ok(r.body.digest.id.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.ok(Array.isArray(r.body.digest.customers));
    assert.ok(Array.isArray(r.body.digest.ideas));
  } finally {
    await h.mf.dispose();
  }
});

async function sentFixture(h) {
  await mailFixture(h);
  const r = await h.action({ action: "send" });
  assert.equal(r.status, 200, JSON.stringify(r));
}

test("reply sync stores full reply text, links the lead, and dedupes", async () => {
  const replies = [
    {
      id: "in-1",
      threadId: "thread-1",
      from: "Test Person <test@example.com>",
      body: "Hello, this is very interesting. Can we talk next week?",
    },
  ];
  const h = await setup({ replies });
  try {
    await sentFixture(h);
    let r = await h.action({ action: "sync" });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.body.matched, 1);
    assert.equal(r.body.stored, 1);
    const lead = await h.get("leads", "l1");
    assert.equal(lead.stage, "REPLIED");
    assert.ok(lead.replyAt);
    assert.match(lead.replySnippet, /Can we talk next week/);
    r = await h.action({ action: "sync" });
    assert.equal(r.body.matched, 0);
    assert.equal(r.body.stored, 0);
    const rows = await h.db
      .prepare("SELECT data FROM objects WHERE kind='mail'")
      .all();
    assert.equal(rows.results.length, 1);
    assert.match(JSON.parse(rows.results[0].data).body, /Can we talk next week/);
  } finally {
    await h.mf.dispose();
  }
});

test("auto-submitted and foreign-thread messages are not stored", async () => {
  const replies = [
    {
      id: "in-auto",
      threadId: "thread-1",
      from: "Test Person <test@example.com>",
      body: "Auto bounce",
      autoSubmitted: true,
    },
    {
      id: "in-foreign",
      threadId: "thread-9",
      from: "Someone <other@example.com>",
      body: "Unrelated",
    },
  ];
  const h = await setup({ replies });
  try {
    await sentFixture(h);
    const r = await h.action({ action: "sync" });
    assert.equal(r.body.stored, 0);
    const rows = await h.db
      .prepare("SELECT 1 FROM objects WHERE kind='mail'")
      .all();
    assert.equal(rows.results.length, 0);
  } finally {
    await h.mf.dispose();
  }
});

test("reply watch off skips the inbox entirely", async () => {
  const replies = [
    {
      id: "in-1",
      threadId: "thread-1",
      from: "Test Person <test@example.com>",
      body: "hi there",
    },
  ];
  const h = await setup({ replies });
  try {
    await sentFixture(h);
    await h.action({ action: "settings", value: { autoReplyWatch: false } });
    const before = h.calls.length;
    const r = await h.action({ action: "sync" });
    assert.equal(r.body.skipped, "REPLY_WATCH_OFF");
    assert.equal(h.calls.length, before);
  } finally {
    await h.mf.dispose();
  }
});

test("concept drafts are written and validated", async () => {
  const h = await setup();
  try {
    let r = await h.action({ action: "contentConcept", concept: "abc" });
    assert.equal(r.status, 400);
    r = await h.action({
      action: "contentConcept",
      concept: "Why clinics lose after-hours enquiries",
      channel: "X post",
    });
    assert.equal(r.status, 200, JSON.stringify(r));
    const c = await h.get("content", r.body.id);
    assert.equal(c.status, "DRAFT");
    assert.equal(c.channel, "X post");
    assert.equal(c.source, "template");
    assert.match(c.body, /after-hours enquiries/);
  } finally {
    await h.mf.dispose();
  }
});

test("updating a post rewrites it, bumps the version and returns to DRAFT", async () => {
  const h = await setup();
  try {
    const r0 = await h.action({
      action: "contentConcept",
      concept: "Reporting dashboards for owner-operators",
    });
    assert.equal(r0.status, 200, JSON.stringify(r0));
    await h.action({
      action: "content",
      id: r0.body.id,
      value: { status: "APPROVED" },
    });
    let r = await h.action({
      action: "content",
      id: r0.body.id,
      value: { update: "Focus on clinics only" },
    });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.body.version, 2);
    const c = await h.get("content", r0.body.id);
    assert.equal(c.status, "DRAFT");
    assert.equal(c.version, 2);
    assert.match(c.body, /Focus on clinics only/);
    r = await h.action({
      action: "content",
      id: r0.body.id,
      value: { update: "x" },
    });
    assert.equal(r.status, 400);
  } finally {
    await h.mf.dispose();
  }
});

test("daily generation honors owner topics and quantity", async () => {
  const h = await setup();
  try {
    await h.action({
      action: "settings",
      value: {
        contentCount: 4,
        contentTopics: "A: enquiries\nB: dashboards\nC: automation",
        autoReplyWatch: true,
        contentAi: false,
      },
    });
    const r = await h.action({ action: "generateContent" });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.body.generated, 4);
    const rows = await h.db
      .prepare("SELECT data FROM objects WHERE kind='content'")
      .all();
    assert.equal(rows.results.length, 4);
    for (const row of rows.results) {
      const c = JSON.parse(row.data);
      assert.equal(c.status, "DRAFT");
      assert.ok(c.topic);
    }
  } finally {
    await h.mf.dispose();
  }
});

async function quietFixture(h, { days = 5, stage = "CONTACTED", replyAt = null, status = "APPROVED", suppressed = false } = {}) {
  await mailFixture(h);
  await h.action({ action: "send" });
  const sentAt = new Date(Date.now() - days * 86400000).toISOString();
  const d = await h.get("drafts", "d1");
  await h.put("drafts", "d1", { ...d, sentAt, status: "SENT" });
  const l = await h.get("leads", "l1");
  await h.put("leads", "l1", {
    ...l,
    firstContactAt: sentAt,
    lastContactAt: sentAt,
    stage,
    status,
    replyAt,
    suppressed,
  });
}

test("follow-up autopilot drafts one nudge for a quiet conversation", async () => {
  const h = await setup();
  try {
    await quietFixture(h);
    let r = await h.action({ action: "followup" });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.body.created, 1);
    const rows = await h.db
      .prepare("SELECT id,data FROM objects WHERE kind='drafts'")
      .all();
    const fu = rows.results.map((x) => JSON.parse(x.data)).find((d) => d.kind === "followup");
    assert.ok(fu, "expected a follow-up draft");
    assert.equal(fu.status, "DRAFT");
    assert.equal(fu.approvedAt, null);
    assert.match(fu.subject, /^Re: /);
    assert.ok(await h.get("tasks", "followupdraft-" + fu.id));
    r = await h.action({ action: "followup" });
    assert.equal(r.body.created, 0);
    assert.equal(
      rows.results.length,
      (await h.db.prepare("SELECT id FROM objects WHERE kind='drafts'").all()).results.length,
    );
  } finally {
    await h.mf.dispose();
  }
});

test("follow-ups stop after reply, on hold, suppressed, won or recent sends", async () => {
  for (const scenario of [
    { name: "replied", opts: { replyAt: "2026-09-20T00:00:00.000Z", stage: "REPLIED" } },
    { name: "hold", opts: { status: "HOLD" } },
    { name: "suppressed", opts: { suppressed: true } },
    { name: "won", opts: { stage: "WON" } },
    { name: "recent", opts: { days: 1 } },
  ]) {
    const h = await setup();
    try {
      await quietFixture(h, scenario.opts);
      const r = await h.action({ action: "followup" });
      assert.equal(r.body.created, 0, scenario.name + " should not create a follow-up");
    } finally {
      await h.mf.dispose();
    }
  }
});

test("follow-up maximum is respected and the switch turns it off", async () => {
  const h = await setup();
  try {
    await h.action({ action: "settings", value: { followUpMax: 2 } });
    await quietFixture(h);
    assert.equal((await h.action({ action: "followup" })).body.created, 1);
    const fu = (await h.db.prepare("SELECT id,data FROM objects WHERE kind='drafts'").all())
      .results.map((x) => JSON.parse(x.data))
      .find((d) => d.kind === "followup");
    await h.put("drafts", fu.id, {
      ...fu,
      status: "SENT",
      sentAt: new Date(Date.now() - 9 * 86400000).toISOString(),
    });
    assert.equal((await h.action({ action: "followup" })).body.created, 1);
    assert.equal((await h.action({ action: "followup" })).body.created, 0);
    await h.action({ action: "settings", value: { followUpOn: false } });
    const r = await h.action({ action: "followup" });
    assert.equal(r.body.skipped, "FOLLOW_UP_OFF");
  } finally {
    await h.mf.dispose();
  }
});

test("exports: mail activity XLSX and full backup JSON are real files", async () => {
  const h = await setup();
  try {
    await sentFixture(h);
    const as = (path) =>
      h.mf.dispatchFetch(origin + path, {
        headers: { Cookie: "ps_session=" + session },
      });
    const x = await as("/api/export/mail.xlsx");
    assert.equal(x.status, 200);
    const buf = new Uint8Array(await x.arrayBuffer());
    assert.equal(buf[0], 0x50);
    assert.equal(buf[1], 0x4b);
    assert.match(x.headers.get("Content-Disposition"), /Email-Activity/);
    const b = await as("/api/export/backup.json");
    assert.equal(b.status, 200);
    const json = await b.json();
    assert.equal(json.version, "0.4.0");
    assert.ok(json.objects.leads.length >= 1);
    assert.ok(json.objects.drafts.length >= 1);
    assert.ok(!("credentials" in json.objects));
  } finally {
    await h.mf.dispose();
  }
});

test("weekly digest emails the owner and never consumes send budget", async () => {
  const h = await setup();
  try {
    await mailFixture(h);
    await h.put("leads", "l1", {
      id: "l1",
      company: "Won Co",
      email: "won@example.com",
      consent: "OPT_IN",
      status: "APPROVED",
      stage: "WON",
      replyAt: new Date().toISOString(),
      firstContactAt: new Date().toISOString(),
    });
    const r = await h.action({ action: "digest" });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.ok(r.body.digest.id);
    const sends = h.calls.filter((x) => x.endsWith("/messages/send"));
    assert.equal(sends.length, 1, "owner notification only");
    await h.mf.dispatchFetch(origin + "/api/state", {
      headers: { Cookie: "ps_session=" + session },
    }).then((x) => x.json());
    const audit = await h.db
      .prepare("SELECT data FROM objects WHERE kind='events' ORDER BY rowid DESC LIMIT 5")
      .all();
    assert.ok(
      audit.results.some((e) => /owner/i.test(JSON.parse(e.data).message)),
      "expected an owner-email event",
    );
    assert.ok(
      !(await h.get("sends", new Date().toISOString().slice(0, 10))),
      "owner notification must not create a send-budget row",
    );
  } finally {
    await h.mf.dispose();
  }
});
