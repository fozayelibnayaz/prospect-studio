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
  telegram = false,
  gemini = false,
  pse = false,
  osm = false,
  monthCredits = 0,
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
      ...(telegram
        ? { TELEGRAM_BOT_TOKEN: "bot-token", TELEGRAM_CHAT_ID: "12345" }
        : {}),
      ...(gemini
        ? { GEMINI_API_KEY: "gem", GEMINI_MODEL: "gemini-test", AI_FREE_CONFIRMED: "true" }
        : {}),
      ...(pse ? { GOOGLE_PSE_KEY: "pse-key", GOOGLE_PSE_CX: "pse-cx" } : {}),
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
      if (u.startsWith("https://api.telegram.org/bot"))
        return send({ ok: true, result: { message_id: 1 } });
      if (u.includes("generativelanguage.googleapis.com")) {
        const body = await r.json();
        const prompt = body.contents?.[0]?.parts?.[0]?.text || "";
        const text = /Translate/i.test(prompt)
          ? "অনুবাদিত লেখা"
          : /Classify/i.test(prompt)
            ? "URGENT\nThey asked for a call today."
            : "AI text";
        return send({ candidates: [{ content: { parts: [{ text }] } }] });
      }
      if (u === "https://overpass-api.de/api/interpreter") {
        if (!osm) throw Error("Unexpected overpass call");
        return send({
          elements: [
            {
              type: "node",
              tags: {
                name: "Leeds Bakery",
                website: "https://leedsbakery.co.uk",
                phone: "+44 113 555 0000",
                "addr:street": "9 Kirkgate",
                "addr:city": "Leeds",
                shop: "bakery",
              },
            },
          ],
        });
      }
      if (u.startsWith("https://www.googleapis.com/customsearch/v1")) {
        if (!pse) throw Error("Unexpected PSE call");
        return send({ items: [{ link: "https://pse-found.co.uk/", title: "PSE found business" }] });
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
  if (monthCredits)
    await put("month", new Date().toISOString().slice(0, 7), { credits: monthCredits });
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
  async function state() {
    const r = await mf.dispatchFetch(origin + "/api/state", {
      headers: { Cookie: "ps_session=" + session },
    });
    return { status: r.status, body: await r.json() };
  }
  return { mf, db, calls, put, get, action, state };
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
    assert.equal(
      h.calls.filter((x) => x.endsWith("/messages/send")).length,
      0,
      "suppression stops the send itself (delivery notices may still be read)",
    );
    assert.ok(
      !h.calls.some((x) => x.includes("messages/send")),
      "no message was sent while suppressed",
    );
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

const backupFixture = {
  app: "Prospect Studio",
  version: "0.4.2",
  exportedAt: "2026-09-22T00:00:00.000Z",
  objects: {
    leads: [
      { id: "r1", company: "Restored Co", email: "restored@example.com", status: "APPROVED", stage: "NEW" },
      { id: "l1", company: "Overwrite Me", email: "test@example.com", status: "HOLD", stage: "NEW" },
    ],
    suppression: [{ id: "abc123", at: "2026-01-01T00:00:00.000Z" }],
    credentials: [{ id: "gmail", encrypted: "MUST-NOT-BE-RESTORED" }],
    somethingElse: [{ id: "x1" }],
  },
};

test("restore: dry run writes nothing and reports counts", async () => {
  const h = await setup();
  try {
    await h.put("leads", "l1", { id: "l1", company: "Existing", email: "e@example.com" });
    const r = await h.action({ action: "restore", dryRun: true, mode: "add", backup: backupFixture });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.body.written, 0);
    assert.equal(r.body.summary.leads.new, 1);
    assert.equal(r.body.summary.leads.skipped, 1);
    assert.equal(r.body.summary.credentials.skipped, "not restorable");
    assert.equal(r.body.summary.somethingElse.skipped, "not restorable");
    assert.equal((await h.get("leads", "r1")), null);
    assert.equal((await h.get("leads", "l1")).company, "Existing");
  } finally {
    await h.mf.dispose();
  }
});

test("restore: add mode keeps existing records, update mode replaces them", async () => {
  const h = await setup();
  try {
    await h.put("leads", "l1", { id: "l1", company: "Existing", email: "e@example.com" });
    let r = await h.action({ action: "restore", mode: "add", backup: backupFixture });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.body.written, 2, "one new lead + suppression");
    assert.equal((await h.get("leads", "r1")).company, "Restored Co");
    assert.equal((await h.get("leads", "l1")).company, "Existing");
    assert.ok(await h.get("suppression", "abc123"));
    assert.equal(await h.get("credentials", "gmail"), null);
    r = await h.action({ action: "restore", mode: "update", backup: backupFixture });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal((await h.get("leads", "l1")).company, "Overwrite Me");
  } finally {
    await h.mf.dispose();
  }
});

test("restore: rejects foreign files and bad modes", async () => {
  const h = await setup();
  try {
    let r = await h.action({ action: "restore", backup: { app: "Something Else", objects: {} } });
    assert.equal(r.status, 400);
    r = await h.action({ action: "restore", backup: { app: "Prospect Studio", objects: {} }, mode: "replace" });
    assert.equal(r.status, 400);
    r = await h.action({ action: "restore", mode: "add" });
    assert.equal(r.status, 400);
  } finally {
    await h.mf.dispose();
  }
});

test("restore: a snapshot without row detail fails clearly instead of crashing", async () => {
  const h = await setup();
  try {
    await h.put("reports", "2026-09-20", { id: "2026-09-20", at: "2026-09-21T00:00:00.000Z", counts: { total: 3, held: 0 }, target: 50 });
    const r = await h.mf.dispatchFetch(origin + "/api/reports/2026-09-20.xlsx", {
      headers: { Cookie: "ps_session=" + session },
    });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /no stored row detail/i);
  } finally {
    await h.mf.dispose();
  }
});

async function overdueFixture(h, { status = "OVERDUE", days = 5, leadOverrides = {} } = {}) {
  await mailFixture(h);
  const dueAt = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const l = await h.get("leads", "l1");
  await h.put("leads", "l1", { ...l, stage: "WON", replyAt: new Date().toISOString(), ...leadOverrides });
  await h.put("invoices", "inv1", {
    id: "inv1",
    leadId: "l1",
    amount: 15000,
    currency: "USD",
    dueAt,
    status,
    createdAt: new Date().toISOString(),
  });
}

test("invoice reminders: one polite draft for an overdue invoice, then none", async () => {
  const h = await setup();
  try {
    await overdueFixture(h);
    let r = await h.action({ action: "invoiceReminders" });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.body.created, 1);
    const d = await h.db.prepare("SELECT id,data FROM objects WHERE kind='drafts'").all();
    const rem = d.results.map((x) => JSON.parse(x.data)).find((x) => x.kind === "invoice-reminder");
    assert.ok(rem);
    assert.equal(rem.status, "DRAFT");
    assert.equal(rem.invoiceId, "inv1");
    assert.ok(await h.get("tasks", "invtask-" + rem.id));
    r = await h.action({ action: "invoiceReminders" });
    assert.equal(r.body.created, 0, "no duplicate while one is pending");
  } finally {
    await h.mf.dispose();
  }
});

test("invoice reminders: skipped when paid, not due, suppressed, on hold or capped", async () => {
  for (const [name, opts] of [
    ["paid", { status: "PAID" }],
    ["not due", { days: -3 }],
    ["suppressed", { leadOverrides: { suppressed: true } }],
    ["on hold", { leadOverrides: { status: "HOLD" } }],
  ]) {
    const h = await setup();
    try {
      await overdueFixture(h, opts);
      const r = await h.action({ action: "invoiceReminders" });
      assert.equal(r.body.created, 0, name);
    } finally {
      await h.mf.dispose();
    }
  }
  const h = await setup();
  try {
    await overdueFixture(h);
    await h.action({ action: "invoiceReminders" });
    const all = (await h.db.prepare("SELECT id,data FROM objects WHERE kind='drafts'").all()).results.map((x) => JSON.parse(x.data));
    const rem = all.find((x) => x.kind === "invoice-reminder");
    await h.put("drafts", rem.id, { ...rem, status: "SENT", sentAt: new Date(Date.now() - 8 * 86400000).toISOString() });
    await h.put("invoices", "inv1", { ...(await h.get("invoices", "inv1")), reminderSentAt: new Date(Date.now() - 8 * 86400000).toISOString() });
    assert.equal((await h.action({ action: "invoiceReminders" })).body.created, 1, "second reminder allowed");
    const all2 = (await h.db.prepare("SELECT id,data FROM objects WHERE kind='drafts'").all()).results.map((x) => JSON.parse(x.data));
    for (const d of all2.filter((x) => x.kind === "invoice-reminder"))
      await h.put("drafts", d.id, { ...d, status: "SENT", sentAt: new Date().toISOString() });
    await h.put("invoices", "inv1", { ...(await h.get("invoices", "inv1")), reminderSentAt: new Date(Date.now() - 8 * 86400000).toISOString() });
    assert.equal((await h.action({ action: "invoiceReminders" })).body.created, 0, "two-reminder cap holds");
  } finally {
    await h.mf.dispose();
  }
});

test("sending a reminder stamps the invoice", async () => {
  const h = await setup();
  try {
    await overdueFixture(h);
    await h.action({ action: "invoiceReminders" });
    const drafts = (await h.db.prepare("SELECT id,data FROM objects WHERE kind='drafts'").all()).results.map((x) => JSON.parse(x.data));
    const rem = drafts.find((x) => x.kind === "invoice-reminder");
    await h.action({ action: "approve", id: rem.id });
    const r = await h.action({ action: "send" });
    assert.equal(r.status, 200, JSON.stringify(r));
    const inv = await h.get("invoices", "inv1");
    assert.ok(inv.reminderSentAt, "invoice stamped when reminder sends");
  } finally {
    await h.mf.dispose();
  }
});

test("pause window blocks sending, follow-ups and reminders but not discovery", async () => {
  const h = await setup();
  try {
    await quietFixture(h);
    const today = new Date().toISOString().slice(0, 10);
    await h.action({ action: "settings", value: { pauseWindows: `${today}..${today}` } });
    const send = await h.action({ action: "send" });
    assert.equal(send.body.status, "PAUSED_WINDOW");
    const fu = await h.action({ action: "followup" });
    assert.equal(fu.body.skipped, "PAUSE_WINDOW");
    const rem = await h.action({ action: "invoiceReminders" });
    assert.equal(rem.body.skipped, "PAUSE_WINDOW");
    const before = h.calls.length;
    const disc = await h.action({ action: "discover" });
    assert.equal(disc.status, 200, "discovery still runs during a pause window");
  } finally {
    await h.mf.dispose();
  }
});

test("urgent watch: a reply in my thread flags URGENT, notifies and closes on handled", async () => {
  const h = await setup({
    telegram: true,
    gemini: true,
    replies: [
      {
        id: "m-urgent",
        threadId: "thread-1",
        from: "Priya <priya@example.com>",
        subject: "Re: tracking help",
        body: "Please call now — we want to sign this week. Reach me on +44 7700 900123.",
      },
    ],
  });
  try {
    await mailFixture(h);
    await h.put("mail", "sent-1", {
      id: "sent-1",
      direction: "OUT",
      leadId: "l1",
      threadId: "thread-1",
      at: new Date().toISOString(),
      subject: "Test outreach",
      body: "hello",
    });
    const r = await h.action({ action: "urgentCheck" });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.body.flagged, 1);
    const rec = await h.get("urgent", "m-urgent");
    assert.equal(rec.tier, "URGENT", JSON.stringify(rec));
    assert.equal(rec.handled, false);
    assert.equal(rec.leadId, "l1");
    assert.ok(rec.hits.some((x) => /call now/.test(x)));
    assert.ok(h.calls.some((x) => x.startsWith("https://api.telegram.org/bot")));
    const task = await h.get("tasks", "urgent-m-urgent");
    assert.equal(task.status, "OPEN");
    assert.match(task.title, /Call back/);
    assert.equal((await h.get("leads", "l1")).urgentTier, "URGENT");
    const done = await h.action({ action: "urgentHandled", id: "m-urgent" });
    assert.equal(done.status, 200);
    assert.equal((await h.get("urgent", "m-urgent")).handled, true);
    assert.equal((await h.get("tasks", "urgent-m-urgent")).status, "DONE");
    assert.equal((await h.get("leads", "l1")).urgentAt, null);
  } finally {
    await h.mf.dispose();
  }
});

test("urgent watch ignores ordinary replies, respects the switch and never watches the whole inbox by default", async () => {
  const h = await setup({
    replies: [
      { id: "m-plain", threadId: "thread-1", from: "Test business <test@example.com>", subject: "Re: hi", body: "Thanks, noted. No rush." },
      { id: "m-other", threadId: "thread-9", from: "b@example.com", subject: "Call now", body: "Please call now" },
      { id: "m-forward", threadId: "thread-1", from: "Accountant <books@example.org>", subject: "Fwd: your note", body: "Passing this to our owner." },
    ],
  });
  try {
    await mailFixture(h);
    await h.put("mail", "sent-1", {
      id: "sent-1",
      direction: "OUT",
      leadId: "l1",
      threadId: "thread-1",
      at: new Date().toISOString(),
      subject: "Test outreach",
      body: "hello",
    });
    let r = await h.action({ action: "urgentCheck" });
    assert.equal(r.body.flagged, 1, "only the new-sender thread is flagged");
    assert.equal((await h.get("urgent", "m-plain")), null, "ordinary replies stay out of the alert list");
    assert.equal((await h.get("inboxlog", "m-plain")).class, "NORMAL", "but every message is stored for the weekly skim");
    assert.equal((await h.get("inboxlog", "m-forward")).class, "FORWARD");
    assert.equal(await h.get("urgent", "m-other"), null, "threads that are not ours are ignored");
    assert.ok(r.body.stored >= 2);
    await h.action({ action: "settings", value: { watchAllInbox: true } });
    r = await h.action({ action: "urgentCheck" });
    assert.equal(r.body.flagged, 1);
    assert.equal((await h.get("urgent", "m-other")).tier, "URGENT");
    assert.equal((await h.get("urgent", "m-other")).class, "INTERESTED");
    await h.action({ action: "settings", value: { urgentWatch: false } });
    assert.equal((await h.action({ action: "urgentCheck" })).body.skipped, "URGENT_WATCH_OFF");
  } finally {
    await h.mf.dispose();
  }
});

test("urgent watch needs Gmail and the AI second opinion stays behind its own switch", async () => {
  const h = await setup({ gemini: true, telegram: true });
  try {
    assert.equal((await h.action({ action: "urgentCheck" })).body.skipped, "GMAIL_NOT_CONNECTED");
    const ai = await h.action({ action: "translate", text: "Hello there", target: "bn" });
    assert.equal(ai.status, 200);
    assert.match(ai.body.text, /[\u0980-\u09FF]/);
  } finally {
    await h.mf.dispose();
  }
});

test("language: per-lead Bangla draft, global default and lead override validation", async () => {
  const h = await setup();
  try {
    await h.put("leads", "bn1", {
      id: "bn1",
      company: "ঢাকা ট্রেডার্স",
      email: "biz@example.com",
      consent: "OPT_IN",
      contactEvidence: "fixture",
      status: "APPROVED",
      stage: "NEW",
      language: "bn",
    });
    await h.action({ action: "settings", value: { language: "bn" } });
    let r = await h.action({ action: "draft", id: "bn1", kind: "outreach" });
    assert.equal(r.status, 200, JSON.stringify(r));
    const draft = Object.values(
      (await h.db.prepare("SELECT data FROM objects WHERE kind='drafts'").all()).results,
    )
      .map((x) => JSON.parse(x.data))
      .find((x) => x.leadId === "bn1");
    assert.equal(draft.language, "bn");
    assert.ok(/[\u0980-\u09FF]/.test(draft.body));
    assert.ok(draft.subject.length > 0);
    assert.equal(
      (await h.action({ action: "leadLanguage", id: "bn1", language: "en" })).body.language,
      "en",
    );
    assert.equal((await h.action({ action: "leadLanguage", id: "bn1", language: "de" })).status, 400);
    assert.equal((await h.action({ action: "settings", value: { language: "fr" } })).status, 400);
  } finally {
    await h.mf.dispose();
  }
});

test("growth actions: launch plan, playbook tasks, content starters and health check", async () => {
  const h = await setup();
  try {
    const plan = await h.action({
      action: "launchPlan",
      answers: { offer: "websites", audience: "cafes", price: "300 USD", city: "Dhaka", hours: "12" },
    });
    assert.equal(plan.status, 200, JSON.stringify(plan.body));
    assert.ok(plan.body.plan.length >= 10);
    const task = await h.get("tasks", plan.body.plan[0].id);
    assert.equal(task.status, "OPEN");
    assert.equal(task.type, plan.body.plan[0].type);

    const play = await h.action({ action: "playbookToTasks", ids: ["p1", "p2"] });
    assert.equal(play.body.added, 2);
    const starter = await h.action({ action: "startersToContent", ids: ["c1"] });
    assert.equal(starter.body.added, 1);
    const content = Object.values(
      (await h.db.prepare("SELECT data FROM objects WHERE kind='content'").all()).results,
    ).map((x) => JSON.parse(x.data));
    assert.equal(content.length, 1);
    assert.equal(content[0].status, "DRAFT");

    const health = await h.action({ action: "health", goals: 1 });
    assert.equal(health.status, 200, JSON.stringify(health.body));
    assert.ok(Array.isArray(health.body.items) && health.body.items.length > 0);
    assert.ok(health.body.last);
    const state = await h.mf.dispatchFetch(origin + "/api/state", {
      headers: { Cookie: "ps_session=" + session },
    });
    const payload = await state.json();
    assert.ok(payload.playbook.length >= 10);
    assert.ok(payload.contentStarters.length >= 5);
    assert.equal(payload.settings.language, "en");
    assert.ok("goals" in payload);
  } finally {
    await h.mf.dispose();
  }
});

test("fallback chain: spent budget switches discovery to Google PSE and then to OpenStreetMap", async () => {
  const pseH = await setup({ pse: true, monthCredits: 901, telegram: true });
  try {
    const r = await pseH.action({ action: "discover" });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.ok(pseH.calls.some((x) => x.startsWith("https://www.googleapis.com/customsearch/v1")));
    assert.ok(!pseH.calls.some((x) => x.endsWith("/api.tavily.com/search") || x.endsWith("/search")));
    const mode = await pseH.get("runtime", "discoveryMode");
    assert.equal(mode.mode, "PSE");
    assert.match(mode.reason, /900 credits/);
    assert.ok(pseH.calls.some((x) => x.startsWith("https://api.telegram.org/bot")));
  } finally {
    await pseH.mf.dispose();
  }
  const osmH = await setup({ osm: true, monthCredits: 950 });
  try {
    const r = await osmH.action({ action: "discover" });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.ok(osmH.calls.includes("https://overpass-api.de/api/interpreter"));
    const leads = (await osmH.db.prepare("SELECT data FROM objects WHERE kind='leads'").all()).results.map(
      (x) => JSON.parse(x.data),
    );
    assert.equal(leads.length, 1);
    assert.equal(leads[0].company, "Leeds Bakery");
    assert.match(leads[0].evidence, /OpenStreetMap/);
    assert.equal(leads[0].status, "UNREVIEWED");
    assert.ok(leads[0].fitScore >= 0 && leads[0].fitScore <= 100);
    assert.equal((await osmH.get("runtime", "discoveryMode")).mode, "OSM");
  } finally {
    await osmH.mf.dispose();
  }
});

test("research enrichment stores platform, analytics, socials and a transparent fit score", async () => {
  const h = await setup();
  try {
    const r = await h.action({ action: "discover" });
    assert.equal(r.status, 200, JSON.stringify(r));
    await h.action({ action: "discover" });
    const leads = (await h.db.prepare("SELECT data FROM objects WHERE kind='leads'").all()).results.map(
      (x) => JSON.parse(x.data),
    );
    assert.equal(leads.length, 1);
    assert.equal(leads[0].platform, "unknown");
    assert.ok(Array.isArray(leads[0].fitReasons));
    assert.ok(Number.isInteger(leads[0].fitScore));
    assert.equal(typeof leads[0].siteLanguage, "string");
  } finally {
    await h.mf.dispose();
  }
});

test("new settings round-trip and are bounded", async () => {
  const h = await setup();
  try {
    const ok = await h.action({
      action: "settings",
      value: {
        language: "bn",
        urgentWords: "ready to sign",
        urgentAi: true,
        watchAllInbox: true,
        goalRevenue: 25000,
        goalCustomers: 4,
      },
    });
    assert.equal(ok.status, 200, JSON.stringify(ok));
    const s = await h.get("settings", "main");
    assert.equal(s.language, "bn");
    assert.equal(s.goalRevenue, 25000);
    assert.equal(s.urgentAi, true);
    assert.equal(s.watchAllInbox, true);
    assert.equal(
      (await h.action({ action: "settings", value: { urgentWords: "x".repeat(501) } })).status,
      400,
    );
    assert.equal(
      (await h.action({ action: "settings", value: { goalRevenue: -5 } })).status,
      400,
    );
    assert.equal(await h.get("urgent", "nothing"), null);
    const list = await h.action({ action: "urgent" });
    assert.deepEqual(list.body.urgent, []);
  } finally {
    await h.mf.dispose();
  }
});

/* ============================ v0.8 owner feedback ======================== */
test("v0.8: bulk review on every list, and approval needs a recorded basis", async () => {
  const h = await setup();
  try {
    for (const i of [1, 2, 3])
      await h.put("leads", "b" + i, {
        id: "b" + i,
        company: "Business " + i,
        email: "owner" + i + "@example.com",
        consent: "NONE",
        contactEvidence: "",
        status: "UNREVIEWED",
        stage: "NEW",
        niche: "Website & WordPress",
        platform: "wordpress",
        analytics: false,
      });
    let r = await h.action({ action: "bulkLeads", op: "approve", ids: ["b1", "b2", "b3"], basis: "" });
    assert.equal(r.status, 400, "no basis, no bulk approval");
    r = await h.action({
      action: "bulkLeads",
      op: "approve",
      ids: ["b1", "b2", "b3"],
      basis: "Read each public contact page; contact relates to their stated business.",
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    for (const id of ["b1", "b2", "b3"]) {
      const l = await h.get("leads", id);
      assert.equal(l.status, "APPROVED");
      assert.match(l.contactEvidence, /public contact page/);
    }
    await h.action({ action: "bulkLeads", op: "hold", ids: ["b2"], basis: "" });
    assert.equal((await h.get("leads", "b2")).status, "HOLD");
    await h.action({ action: "bulkLeads", op: "unreview", ids: ["b2"], basis: "" });
    assert.equal((await h.get("leads", "b2")).status, "UNREVIEWED");
    r = await h.action({ action: "bulkLeads", op: "draft", ids: ["b1", "b2"], basis: "" });
    assert.equal(r.status, 200);
    const drafts = r.body.results.filter((x) => x.draftId);
    assert.equal(drafts.length, 1, "only the still-approved record gets a draft");
    const d = await h.get("drafts", drafts[0].draftId);
    assert.equal(d.status, "DRAFT", "a bulk-created draft is still a draft");
    assert.match(d.body, /recorded basis|public page|contact page|Would a short, specific example/, JSON.stringify(d.body.slice(0, 120)));
    await h.action({ action: "bulkLeads", op: "suppress", ids: ["b3"], basis: "" });
    assert.equal((await h.get("leads", "b3")).suppressed, true);
    const sup = await h.db.prepare("SELECT data FROM objects WHERE kind='suppression'").all();
    assert.ok(
      sup.results.some((r) => JSON.parse(r.data).email === "owner3@example.com"),
      "suppression list written by the bulk action",
    );
    await h.action({ action: "bulkLeads", op: "restore", ids: ["b3"], basis: "" });
    assert.equal((await h.get("leads", "b3")).suppressed, false);
  } finally {
    await h.mf.dispose();
  }
});
test("v0.8: bulk approval of drafts skips the ones without a recorded basis", async () => {
  const h = await setup();
  try {
    await h.put("leads", "g1", { id: "g1", company: "Good", email: "a@example.com", status: "APPROVED", stage: "NEW", contactEvidence: "Owner read the public contact page before approving." });
    await h.put("leads", "g2", { id: "g2", company: "Thin", email: "b@example.com", status: "APPROVED", stage: "NEW", contactEvidence: "" });
    await h.put("leads", "g3", { id: "g3", company: "Gone", email: "c@example.com", status: "APPROVED", stage: "NEW", contactEvidence: "Basis recorded properly here.", suppressed: true });
    for (const [did, lid] of [["db1", "g1"], ["db2", "g2"], ["db3", "g3"]])
      await h.put("drafts", did, { id: did, leadId: lid, kind: "outreach", status: "DRAFT", subject: "s", body: "b" });
    const r = await h.action({ action: "approveBulk", ids: ["db1", "db2", "db3"] });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.approved, 1);
    assert.equal((await h.get("drafts", "db1")).status, "APPROVED");
    assert.equal((await h.get("drafts", "db1")).approvedBy, "OWNER_BULK");
    assert.equal((await h.get("drafts", "db2")).status, "DRAFT");
    assert.equal((await h.get("drafts", "db3")).status, "DRAFT");
    assert.deepEqual(r.body.skipped.map((x) => x.why).sort(), ["NO_RECORDED_BASIS", "SUPPRESSED"]);
  } finally {
    await h.mf.dispose();
  }
});
test("v0.8: address checking says what it proved, and stores every verdict", async () => {
  const h = await setup();
  try {
    await h.put("leads", "e1", { id: "e1", company: "Has mail", email: "owner@example.com", status: "UNREVIEWED", stage: "NEW" });
    await h.put("leads", "e2", { id: "e2", company: "Bad syntax", email: "not-an-email", status: "UNREVIEWED", stage: "NEW" });
    await h.put("leads", "e3", { id: "e3", company: "No address", status: "UNREVIEWED", stage: "NEW" });
    const r = await h.action({ action: "verifyEmails", limit: 10 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await h.get("leads", "e2")).emailStatus, "INVALID_SYNTAX");
    assert.equal((await h.get("leads", "e3")).emailStatus, undefined, "no address is never given a verdict");
    assert.ok(
      ["MX_OK", "MX_OK_ROLE", "NO_MAIL_SERVER", "SYNTAX_OK"].includes((await h.get("leads", "e1")).emailStatus),
      "e1: " + (await h.get("leads", "e1")).emailStatus,
    );
    assert.ok((await h.get("leads", "e1")).emailCheckedAt, "the check records when it happened");
    const vr = await h.action({ action: "verifyEmails", limit: 5 });
    assert.equal(vr.body.checked, 0, "already-checked rows are not re-queried");
    const st = await h.action({ action: "emailStatuses" });
    assert.equal(st.status, 200);
    assert.ok(st.body.labels.MX_OK.includes("not a delivery proof"), "labels stay honest");
    assert.ok(
      Object.keys(st.body.counts).some((k) => ["MX_OK", "MX_OK_ROLE", "NO_MAIL_SERVER", "SYNTAX_OK", "INVALID_SYNTAX"].includes(k)),
      "counts: " + JSON.stringify(st.body.counts),
    );
    assert.ok(st.body.counts.INVALID_SYNTAX >= 1, "a broken address is counted, not hidden");
    await h.put("drafts", "de2", { id: "de2", leadId: "e2", kind: "outreach", status: "APPROVED", approvedAt: new Date().toISOString(), approvedEmail: "not-an-email", subject: "s", body: "b" });
    await h.put("leads", "e2b", { id: "e2b", company: "Bad domain", email: "owner@no-mail-here.invalid", emailStatus: "NO_MAIL_SERVER", consent: "BUSINESS_REVIEWED", contactEvidence: "Owner read the public contact page.", status: "APPROVED", stage: "NEW" });
    await h.put("drafts", "de2b", { id: "de2b", leadId: "e2b", kind: "outreach", status: "APPROVED", approvedAt: new Date().toISOString(), approvedEmail: "owner@no-mail-here.invalid", subject: "s", body: "b" });
    const before = h.calls.length;
    await h.action({ action: "send" });
    assert.equal(
      h.calls.slice(before).filter((x) => x.includes("messages/send")).length,
      0,
      "an address the checker proved wrong is never sent to",
    );
    const bulk = await h.action({ action: "bulkLeads", op: "verify", ids: ["e1", "e3"], basis: "" });
    assert.equal(bulk.status, 200);
    assert.ok(bulk.body.results.some((x) => x.skipped === "NO_EMAIL"), "a row with no address reports why it was skipped");
  } finally {
    await h.mf.dispose();
  }
});
test("v0.8: every alert case has its own switch, and each alert can explain itself", async () => {
  const h = await setup();
  try {
    const p = await h.action({ action: "notifyPreview" });
    assert.equal(p.status, 200);
    assert.ok(p.body.keys.length >= 10, "one switch per case, got " + p.body.keys.length);
    assert.ok(p.body.keys.every((k) => k.on), "defaults are on");
    assert.match(p.body.example, /matched/, "the example shows where the word match came from");
    let r = await h.action({ action: "settings", value: { notifyContent: false } });
    assert.equal(r.status, 200);
    const p2 = await h.action({ action: "notifyPreview" });
    assert.equal(p2.body.keys.find((k) => k.key === "notifyContent").on, false);
    assert.equal(p2.body.master, true);
    r = await h.action({ action: "settings", value: { notifyAll: false } });
    assert.equal((await h.action({ action: "notifyPreview" })).body.master, false);
    const t = await h.action({ action: "testNotify" });
    assert.equal(t.status, 200);
    assert.match(t.body.text, /test alert/i);
    assert.equal(t.body.sent, false, "no Telegram secret in a test environment — reported, not pretended");
    await h.action({ action: "settings", value: { notifyAll: true } });
    await h.action({ action: "settings", value: { notifyContent: true } });
  } finally {
    await h.mf.dispose();
  }
});
test("v0.8: the state carries markets, address counts and the weekly skim", async () => {
  const h = await setup();
  try {
    await h.put("leads", "m1", { id: "m1", company: "Market test", email: "a@example.com", status: "UNREVIEWED", stage: "NEW", fitScore: 71, cityLabel: "Khulna", country: "Bangladesh" });
    const s = await h.state();
    assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 200));
    assert.ok(s.body.marketCities.countries >= 120, "countries " + s.body.marketCities.countries);
    assert.ok(s.body.marketCities.cities >= 500, "cities " + s.body.marketCities.cities);
    assert.ok(s.body.emailCounts && typeof s.body.emailCounts === "object");
    assert.ok(s.body.emailLabels.MX_OK);
    assert.ok(Array.isArray(s.body.inbox));
    assert.ok(Array.isArray(s.body.inboxGaps));
    assert.ok(Array.isArray(s.body.notifyKeys) && s.body.notifyKeys[0].label);
    await h.put("inboxlog", "i1", { id: "i1", at: new Date().toISOString(), class: "NORMAL", subject: "Showroom opening", snippet: "our showroom opens soon and we need the showroom booking page updated", body: "our showroom opens soon and we need the showroom booking page updated" });
    const s2 = await h.state();
    assert.ok(s2.body.inboxGaps.some((g) => g.word === "showroom"), "a repeated phrase the keyword list is missing surfaces for the weekly skim");
  } finally {
    await h.mf.dispose();
  }
});
test("v0.8: automatic approval is ON, and turning it off puts every draft back in the owner's hands", async () => {
  const h = await setup();
  try {
    await mailFixture(h);
    /* the fixture stores autoSendOptIn:false, so switch the real defaults on first */
    await h.action({ action: "settings", value: { autoApprove: true, autoSendOptIn: true } });
    const s = await h.state();
    assert.equal(s.body.settings.autoApprove, true);
    assert.equal(s.body.settings.autoSendOptIn, true);
    assert.equal(s.body.settings.emailVerify, true);
    await h.action({ action: "settings", value: { autoApprove: false, autoSendOptIn: false } });
    const off = await h.state();
    assert.equal(off.body.settings.autoApprove, false);
    assert.equal(off.body.settings.autoSendOptIn, false);
    await h.put("leads", "z1", { id: "z1", company: "Fresh", email: "fresh@example.com", consent: "BUSINESS_REVIEWED", contactEvidence: "Owner read the public contact page; contact relates to the stated business.", status: "APPROVED", stage: "NEW" });
    await h.action({ action: "bulkLeads", op: "draft", ids: ["z1"], basis: "" });
    const draftRows = await h.db.prepare("SELECT data FROM objects WHERE kind='drafts'").all();
    const draft = draftRows.results.map((r) => JSON.parse(r.data)).find((d) => d.leadId === "z1");
    assert.ok(draft);
    assert.equal(draft.status, "DRAFT", "auto-approve off means the draft waits");
    const before = h.calls.length;
    await h.action({ action: "send" });
    const sentFresh = h.calls.slice(before).filter((x) => x.includes("messages/send"));
    assert.equal(sentFresh.length, 1, "with auto-send OFF the queue stops at anything the owner has not approved");
    assert.ok(sentFresh[0].includes("messages/send"));
    const freshDraft = (await h.db.prepare("SELECT data FROM objects WHERE kind='drafts'").all()).results
      .map((r) => JSON.parse(r.data))
      .find((d) => d.id === draft.id);
    assert.equal(freshDraft.status, "DRAFT", "and the un-approved draft is still sitting in the queue");
    await h.action({ action: "settings", value: { autoApprove: true, autoSendOptIn: true } });
    await h.action({ action: "approve", id: draft.id });
    await h.action({ action: "send" });
    assert.ok(h.calls.some((x) => x.includes("messages/send")), "with both back on, an approved message sends again");
  } finally {
    await h.mf.dispose();
  }
});
test("v0.8: a public version endpoint proves what is deployed here", async () => {
  const h = await setup();
  try {
    const r = await h.mf.dispatchFetch("http://app.test/api/version");
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.version, "0.8.0");
    assert.ok(b.features.includes("auto-approve-default-on"));
    assert.ok(b.features.includes("bulk-review-with-basis"));
    assert.ok(b.features.includes("mx-address-check"));
    assert.ok(b.features.includes("global-markets"));
    assert.ok(b.markets.countries >= 120 && b.markets.cities >= 500);
    assert.equal("settings" in b, false, "the public endpoint carries no private data");
    assert.ok(!JSON.stringify(b).includes("@"), "no addresses leak from the public endpoint");
  } finally {
    await h.mf.dispose();
  }
});
test("v0.8: tasks can be selected in bulk and closed or reopened", async () => {
  const h = await setup();
  try {
    for (const i of [1, 2, 3])
      await h.put("tasks", "t" + i, { id: "t" + i, title: "Task " + i, due: "2026-09-25", status: "OPEN", type: "FOLLOW_UP" });
    let r = await h.action({ action: "bulkTasks", op: "complete", ids: ["t1", "t2"] });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.count, 2);
    assert.equal((await h.get("tasks", "t1")).status, "DONE");
    assert.equal((await h.get("tasks", "t2")).status, "DONE");
    assert.equal((await h.get("tasks", "t3")).status, "OPEN");
    assert.ok((await h.get("tasks", "t1")).completedAt);
    r = await h.action({ action: "bulkTasks", op: "reopen", ids: ["t1"] });
    assert.equal((await h.get("tasks", "t1")).status, "OPEN");
    assert.equal((await h.get("tasks", "t1")).completedAt, null);
    assert.equal((await h.action({ action: "bulkTasks", op: "complete", ids: [] })).status, 400);
    assert.equal((await h.action({ action: "bulkTasks", op: "delete", ids: ["t1"] })).status, 400);
    const ev = (await h.db.prepare("SELECT data FROM objects WHERE kind='events'").all()).results
      .map((x) => JSON.parse(x.data))
      .filter((x) => String(x.message || "").includes("in one action"));
    assert.ok(ev.length >= 2, "bulk task actions are logged like every other decision");
  } finally {
    await h.mf.dispose();
  }
});
