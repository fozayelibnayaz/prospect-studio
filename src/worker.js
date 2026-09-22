import Research from "./research.js";
import {
  defaults,
  countryCodes,
  countryName,
  niches,
  metrics,
  cohorts,
  target,
  eligible,
  makeDraft,
  validSettings,
  generateContent,
  contentFromConcept,
  makeFollowup,
  checkinPlan,
  marketingIdeas,
  businessMap,
} from "./domain.js";
import { xlsx, xlsxBook } from "./xlsx.js";

async function externalFetch(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(25000) });
}
const now = () => new Date().toISOString(),
  id = () => crypto.randomUUID(),
  day = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
  demo = (e) => e.DEMO_MODE === "true";
const json = (v, status = 200) =>
  new Response(JSON.stringify(v), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const cookie = (r, k) =>
  (r.headers.get("Cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(k + "="))
    ?.slice(k.length + 1);
async function get(e, k, i) {
  const r = await e.DB.prepare("SELECT data FROM objects WHERE kind=? AND id=?")
    .bind(k, i)
    .first();
  return r ? JSON.parse(r.data) : null;
}
async function put(e, k, i, v) {
  await e.DB.prepare(
    "INSERT INTO objects(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,version=objects.version+1",
  )
    .bind(k, i, JSON.stringify(v))
    .run();
  return v;
}
async function list(e, k) {
  return (
    await e.DB.prepare(
      "SELECT data FROM objects WHERE kind=? ORDER BY rowid DESC LIMIT 3000",
    )
      .bind(k)
      .all()
  ).results.map((r) => JSON.parse(r.data));
}
async function log(e, type, message) {
  await put(e, "events", id(), {
    at: now(),
    type,
    message: String(message).slice(0, 300),
  });
  await e.DB.prepare(
    "DELETE FROM objects WHERE kind='events' AND rowid NOT IN (SELECT rowid FROM objects WHERE kind='events' ORDER BY rowid DESC LIMIT 200)",
  ).run();
}
async function settings(e) {
  return { ...defaults, ...(await get(e, "settings", "main")) };
}
async function lease(e) {
  const r = await e.DB.prepare(
    "INSERT INTO leases(id,expires) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET expires=excluded.expires WHERE leases.expires<? RETURNING expires",
  )
    .bind("work", Date.now() + 180000, Date.now())
    .first();
  if (!r) throw Error("Another task is running. Try again shortly.");
  return r.expires;
}
async function release(e, ticket) {
  await e.DB.prepare("DELETE FROM leases WHERE id=? AND expires=?")
    .bind("work", ticket)
    .run();
}
async function hash(s) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function safeError(err) {
  const s = String(err.message || err);
  return s.startsWith("TAVILY_") ||
    s.startsWith("GMAIL_") ||
    s.startsWith("AI_") ||
    s.length < 180
    ? s.slice(0, 180)
    : "Operation failed; inspect worker logs privately.";
}
async function encrypt(e, text, decrypt = false) {
  if (!e.ENCRYPTION_KEY || e.ENCRYPTION_KEY.length < 32)
    throw Error("Set an ENCRYPTION_KEY secret of at least 32 characters");
  const key = await crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(e.ENCRYPTION_KEY),
    ),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  if (decrypt) {
    const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes.slice(0, 12) },
        key,
        bytes.slice(12),
      ),
    );
  }
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    enc = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(text),
      ),
    ),
    out = new Uint8Array(iv.length + enc.length);
  out.set(iv);
  out.set(enc, 12);
  return btoa(String.fromCharCode(...out));
}
async function authenticated(r, e) {
  if (demo(e)) return true;
  const sid = cookie(r, "ps_session");
  if (!sid) return false;
  return !!(await e.DB.prepare(
    "SELECT id FROM sessions WHERE id=? AND expires>?",
  )
    .bind(await hash(sid), Date.now())
    .first());
}
function redirect(url, cookies = []) {
  const h = new Headers({ Location: url, "Cache-Control": "no-store" });
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}
async function oauth(r, e, url) {
  if (demo(e)) return redirect("/?notice=Demo_has_no_account_connections");
  const origin = e.APP_ORIGIN;
  if (
    !origin?.startsWith("https://") ||
    !e.GOOGLE_CLIENT_ID ||
    !e.GOOGLE_CLIENT_SECRET ||
    !e.OWNER_EMAIL
  )
    throw Error("Google sign-in has not been configured by the owner");
  if (url.pathname.endsWith("/login") || url.pathname.endsWith("/connect")) {
    const gmail = url.pathname.endsWith("/connect");
    if (gmail && !(await authenticated(r, e)))
      return json({ error: "Sign in first" }, 401);
    if (gmail && !e.ENCRYPTION_KEY)
      throw Error("Configure ENCRYPTION_KEY first");
    const state = id() + id();
    await put(e, "oauth", await hash(state), {
      gmail,
      expires: Date.now() + 600000,
    });
    const q = new URLSearchParams({
      client_id: e.GOOGLE_CLIENT_ID,
      redirect_uri: origin + "/api/auth/callback",
      response_type: "code",
      scope:
        "openid email" +
        (gmail
          ? " https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly"
          : ""),
      state,
      access_type: "offline",
      prompt: gmail ? "consent" : "select_account",
    });
    return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + q, [
      `ps_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    ]);
  }
  const state = url.searchParams.get("state");
  if (!state || cookie(r, "ps_state") !== state)
    throw Error("OAuth state mismatch");
  const key = await hash(state),
    saved = await get(e, "oauth", key);
  await e.DB.prepare("DELETE FROM objects WHERE kind=? AND id=?")
    .bind("oauth", key)
    .run();
  if (!saved || saved.expires < Date.now())
    throw Error("Sign-in expired; start again");
  const res = await externalFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: e.GOOGLE_CLIENT_ID,
      client_secret: e.GOOGLE_CLIENT_SECRET,
      code: url.searchParams.get("code") || "",
      redirect_uri: origin + "/api/auth/callback",
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw Error("Google token exchange failed");
  const tokens = await res.json();
  const ur = await externalFetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: "Bearer " + tokens.access_token },
    },
  );
  if (!ur.ok) throw Error("Google identity check failed");
  const user = await ur.json();
  if (
    user.email?.toLowerCase() !== e.OWNER_EMAIL.toLowerCase() ||
    user.email_verified !== true
  )
    throw Error("Only the configured owner can sign in");
  if (saved.gmail) {
    if (!tokens.refresh_token)
      throw Error("No refresh token returned; reconnect Gmail with consent");
    await put(e, "credentials", "gmail", {
      encrypted: await encrypt(e, tokens.refresh_token),
      connectedAt: now(),
    });
  }
  const sid = id() + id();
  await e.DB.prepare("INSERT INTO sessions(id,expires) VALUES(?,?)")
    .bind(await hash(sid), Date.now() + 7 * 86400000)
    .run();
  return redirect("/", [
    `ps_session=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
    `ps_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  ]);
}
async function access(e) {
  const c = await get(e, "credentials", "gmail");
  if (!c) throw Error("GMAIL_NOT_CONNECTED");
  const r = await externalFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: e.GOOGLE_CLIENT_ID,
      client_secret: e.GOOGLE_CLIENT_SECRET,
      refresh_token: await encrypt(e, c.encrypted, true),
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw Error("GMAIL_REAUTHORIZE_REQUIRED");
  return (await r.json()).access_token;
}
async function gmail(e, path, body, recipient) {
  const token = await access(e);
  if (path === "messages/send") {
    if ((await settings(e)).paused) throw Error("GMAIL_PAUSED_BEFORE_SEND");
    if (
      recipient &&
      (await get(e, "suppression", await hash(recipient.toLowerCase())))
    )
      throw Error("GMAIL_CONTACT_SUPPRESSED");
  }
  const r = await externalFetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/" + path,
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  if (!r.ok) throw Error("GMAIL_HTTP_" + r.status);
  return r.json();
}
async function reserve(e, kind) {
  const d = day(),
    m = d.slice(0, 7),
    b = (await get(e, "budget", d)) || { search: 0, extract: 0, credits: 0 },
    monthly = (await get(e, "month", m)) || { credits: 0 };
  if (
    b[kind] >= (kind === "search" ? 8 : 20) ||
    b.credits >= 28 ||
    monthly.credits >= 900
  )
    throw Error("TAVILY_LOCAL_FREE_CAP");
  b[kind]++;
  b.credits++;
  monthly.credits++;
  await e.DB.batch([
    e.DB.prepare(
      "INSERT INTO objects(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
    ).bind("budget", d, JSON.stringify(b)),
    e.DB.prepare(
      "INSERT INTO objects(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
    ).bind("month", m, JSON.stringify(monthly)),
  ]);
}
async function tavily(e, kind, body) {
  if (demo(e)) throw Error("Demo mode does not call providers");
  if (!e.TAVILY_API_KEY) throw Error("TAVILY_KEY_NOT_CONFIGURED");
  const headers = {
    Authorization: "Bearer " + e.TAVILY_API_KEY,
    "Content-Type": "application/json",
  };
  const usage = await externalFetch("https://api.tavily.com/usage", {
    headers,
  });
  if (!usage.ok) throw Error("TAVILY_USAGE_HTTP_" + usage.status);
  Research.freeUsage(
    await usage.json(),
    1,
    e.TAVILY_PAYGO_DISABLED_CONFIRMED === "true",
  );
  await reserve(e, kind);
  const r = await externalFetch("https://api.tavily.com/" + kind, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    if (r.status === 429) {
      const retry = r.headers.get("retry-after");
      let until = Number(retry)
        ? Date.now() + Number(retry) * 1000
        : Date.parse(retry);
      await put(e, "runtime", "backoff", {
        until: Math.max(
          Date.now() + 3600000,
          Number.isFinite(until) ? until : 0,
        ),
      });
    }
    throw Error("TAVILY_HTTP_" + r.status);
  }
  return r.json();
}
const LISTICLE_TITLE =
  /\b(top|best)\s?\d+|\blist of\b|\bemails?\s?[&and]\s?contacts\b|\bemails?\s?(list|database)\b|\bphone\s?(list|numbers)\b|\bbusiness\s?(directory|contacts)\b|\bcompany\s?(information|registry)\b|find\s?and\s?update|overview\s?-|\bb2b\s+(leads?|database|contacts?|directory|emails?|data|suppliers?|vendors?)\b|\bleads?\s?database\b|\bdatabase of\b|\bdata (provider|reseller)\b/i;
function primary(u, title = "") {
  try {
    return (
      Research.allowed(u) &&
      !/(wpcomstaging\.com|\/find-an?-|\/find-a\/|\/partners\/installers|\/directory(?:\/|$))/i.test(
        u,
      ) &&
      !/(find an? installer|trustpilot|checkatrade|\bdirectory\b)/i.test(title) &&
      !LISTICLE_TITLE.test(title)
    );
  } catch {
    return false;
  }
}
export { primary };
function host(u) {
  const h = new URL(u).hostname.replace(/^www\./, "");
  return /\.(wordpress\.com|wixsite\.com)$/.test(h) ? h : Research.domain(u);
}
async function saveLead(e, l) {
  await e.DB.prepare(
    "INSERT INTO objects(kind,id,data) VALUES('leads',?,?) ON CONFLICT(kind,id) DO UPDATE SET data=CASE WHEN json_extract(objects.data,'$.suppressed')=1 THEN json_set(excluded.data,'$.suppressed',json('true'),'$.consent','NONE') ELSE excluded.data END,version=objects.version+1",
  )
    .bind(l.id, JSON.stringify(l))
    .run();
}
async function discover(e, manual = false) {
  const s = await settings(e);
  if (s.paused) throw Error("System paused");
  if (demo(e)) {
    await log(
      e,
      "DEMO",
      "Discovery simulated. No provider requests or fresh leads claimed.",
    );
    return { simulated: true };
  }
  const backoff = await get(e, "runtime", "backoff");
  if (backoff?.until > Date.now()) throw Error("TAVILY_BACKOFF_ACTIVE");
  let leads = await list(e, "leads");
  if (leads.length >= 2500)
    throw Error("Pilot capacity: archive/export before more imports");
  const runtime = (await get(e, "runtime", "cursor")) || { cursor: 0 };
  let pending = await list(e, "queue"),
    b = (await get(e, "budget", day())) || { search: 0, extract: 0 };
  const today = leads.filter(
    (x) =>
      x.sourceKind === "DISCOVERY" &&
      new Date(x.createdAt).toLocaleDateString("en-CA", {
        timeZone: "Asia/Dhaka",
      }) === day(),
  );
  if (today.filter((x) => x.status !== "HOLD").length >= s.dailyTarget)
    return { targetReached: true };
  const dhakaHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (
    b.search < (manual ? 8 : Math.min(8, Math.floor(dhakaHour / 3) + 1)) &&
    pending.filter((x) => x.phase === "HOME" || x.phase === "CONTACT").length <
      100
  ) {
    const t = target(s, runtime.cursor, leads);
    runtime.cursor++;
    await put(e, "runtime", "cursor", runtime);
    const sectors = [
      "home services company",
      "independent retail shop",
      "restaurant business",
      "education consultancy",
      "tour operator",
      "accountancy practice",
      "property management company",
      "online store",
    ];
    const sector = sectors[(runtime.cursor - 1) % sectors.length];
    const query = `${t.type === "Agency partner" ? "digital agency" : t.type === "Freelancer partner" ? "independent freelance professional" : t.type === "New business" ? "new opening launch " + sector : t.type === "Public work request" ? "business seeking freelance website analytics developer" : sector} ${t.countryLabel} official website contact -site:trustpilot.com -site:facebook.com -site:linkedin.com -site:yelp.com -site:ensun.io -site:gov.uk -site:opencorporates.com -site:crunchbase.com`;
    const results = await tavily(e, "search", {
      query,
      search_depth: "basic",
      auto_parameters: false,
      max_results: 10,
      include_answer: false,
      include_raw_content: false,
    });
    if ((await settings(e)).paused)
      throw Error("Paused before committing discovery");
    for (const r of results.results || []) {
      if (!primary(r.url, r.title)) continue;
      const d = host(r.url),
        leadId = id();
      const claim = await e.DB.prepare(
        "INSERT OR IGNORE INTO dedup(domain,lead_id) VALUES(?,?) RETURNING domain",
      )
        .bind(d, leadId)
        .first();
      if (!claim) continue;
      await put(e, "queue", leadId, {
        id: leadId,
        url: r.url,
        label: String(r.title).replace(/&amp;/g, "&").slice(0, 160),
        target: t,
        query,
        phase: "HOME",
        createdAt: now(),
      });
    }
    await log(
      e,
      "SEARCH",
      `${t.countryLabel} · ${t.type} · ${t.niche}. Results are research candidates, not buyers.`,
    );
  }
  pending = (await list(e, "queue"))
    .filter((x) => ["HOME", "CONTACT"].includes(x.phase) && primary(x.url))
    .sort(
      (a, b) =>
        (a.phase === "CONTACT" ? -1 : 1) - (b.phase === "CONTACT" ? -1 : 1),
    )
    .slice(
      0,
      Math.min(
        5,
        Math.max(
          0,
          s.dailyTarget - today.filter((x) => x.status !== "HOLD").length,
        ),
      ),
    );
  b = (await get(e, "budget", day())) || {};
  if (pending.length && (b.extract || 0) < 20) {
    const data = await tavily(e, "extract", {
      urls: pending.map((x) => (x.phase === "CONTACT" ? x.contact : x.url)),
      extract_depth: "basic",
      format: "markdown",
      timeout: 15,
    });
    if ((await settings(e)).paused)
      throw Error("Paused before committing enrichment");
    if (!Array.isArray(data.results) || !Array.isArray(data.failed_results))
      throw Error("TAVILY_EXTRACT_SCHEMA");
    for (const job of pending) {
      const requested = job.phase === "CONTACT" ? job.contact : job.url;
      const page = data.results.find(
        (x) => Research.url(x.url) === Research.url(requested),
      );
      if (!page) {
        if (job.phase === "HOME") {
          job.phase = "FAILED";
          job.failure = "Primary page extraction failed";
          await put(e, "queue", job.id, job);
          continue;
        }
      }
      let parsed = page
        ? Research.parsePage(
            String(page.raw_content).slice(0, 40000),
            page.url,
            job.target.countryLabel,
          )
        : null;
      if (job.phase === "HOME" && parsed.contact && primary(parsed.contact)) {
        job.home = parsed;
        job.contact = parsed.contact;
        job.phase = "CONTACT";
        await put(e, "queue", job.id, job);
        continue;
      }
      const p = job.home
        ? Research.merge(job.home, parsed || undefined)
        : Research.merge(parsed);
      const lead = {
        id: job.id,
        sourceKind: "DISCOVERY",
        company: job.label,
        website: job.url,
        country: job.target.countryLabel,
        countryCode: job.target.country,
        type: job.target.type,
        niche: job.target.niche,
        email: p.email || "",
        phone: p.phone || "",
        address: p.address || "",
        person: p.person || "",
        emailSource: p.emailSource || "",
        phoneSource: p.phoneSource || "",
        addressSource: p.addressSource || "",
        source: job.url,
        evidence: `Search hypothesis: ${job.query}. Public page extraction; intent and fit unverified.`,
        countryEvidence: p.geo,
        status:
          p.flags.noOutsource || !p.flags.business ? "HOLD" : "UNREVIEWED",
        stage: "NEW",
        consent: "NONE",
        contactEvidence: "",
        suppressed: false,
        createdAt: now(),
        notes: "",
        nextActionAt: null,
      };
      await saveLead(e, lead);
      job.phase = "IMPORTED";
      delete job.home;
      await put(e, "queue", job.id, job);
    }
  }
  return { counts: metrics(await list(e, "leads")) };
}
async function sendOne(e) {
  const s = await settings(e);
  if (s.paused) return { status: "PAUSED", sent: 0 };
  const drafts = await list(e, "drafts"),
    leads = await list(e, "leads");
  for (const stale of drafts.filter(
    (x) =>
      x.status === "SENDING" && Date.parse(x.sendingAt) < Date.now() - 180000,
  )) {
    stale.status = "UNKNOWN";
    stale.failure = "Delivery uncertain: inspect Gmail Sent before any retry";
    await put(e, "drafts", stale.id, stale);
  }
  const d = drafts.find(
    (x) =>
      ["DRAFT", "APPROVED"].includes(x.status) &&
      !eligible(
        leads.find((l) => l.id === x.leadId),
        x,
        s,
      ),
  );
  if (!d) return { sent: 0 };
  if (demo(e)) {
    d.status = "SIMULATED";
    d.simulatedAt = now();
    await put(e, "drafts", d.id, d);
    await log(
      e,
      "DEMO",
      "Message simulated, not sent. Outreach counts unchanged.",
    );
    return { simulated: true };
  }
  const limit = (await get(e, "sends", day())) || { attempts: 0 };
  if (limit.attempts >= s.dailySendLimit) return { capped: true };
  if (!(await get(e, "credentials", "gmail")))
    throw Error("GMAIL_NOT_CONNECTED");
  const reservedDay = day();
  await e.DB.prepare(
    "INSERT OR IGNORE INTO objects(kind,id,data) VALUES('sends',?,?)",
  )
    .bind(reservedDay, JSON.stringify({ attempts: 0 }))
    .run();
  const reservation = await e.DB.prepare(
    "UPDATE objects SET data=json_set(data,'$.attempts',json_extract(data,'$.attempts')+1) WHERE kind='sends' AND id=? AND json_extract(data,'$.attempts')<? RETURNING id",
  )
    .bind(reservedDay, s.dailySendLimit)
    .first();
  if (!reservation) return { capped: true };
  const l = leads.find((x) => x.id === d.leadId);
  const beforeClaim = JSON.stringify(d);
  d.status = "SENDING";
  d.sendingAt = now();
  d.messageId = `${id()}@prospect-studio.invalid`;
  const claimed = await e.DB.prepare(
    "UPDATE objects SET data=?,version=version+1 WHERE kind='drafts' AND id=? AND data=? RETURNING id",
  )
    .bind(JSON.stringify(d), d.id, beforeClaim)
    .first();
  if (!claimed) return { status: "DRAFT_CHANGED_REVIEW_AGAIN", sent: 0 };
  try {
    const fresh = await settings(e),
      contact = await get(e, "leads", l.id);
    const blocked = eligible(contact, d, fresh);
    if (blocked) throw Error(blocked);
    const unsub = id() + id();
    await put(e, "unsubscribe", await hash(unsub), {
      leadId: l.id,
      email: l.email.toLowerCase(),
    });
    const body =
      d.body +
      `\n\nStop future messages: ${e.APP_ORIGIN}/unsubscribe?token=${unsub}`;
    if (/[\r\n]/.test(d.subject) || /[\r\n]/.test(l.email))
      throw Error("Invalid email headers");
    const enc = (t) =>
      btoa(String.fromCharCode(...new TextEncoder().encode(t)));
    const mime = `From: ${e.OWNER_EMAIL}\r\nTo: ${l.email}\r\nSubject: =?UTF-8?B?${enc(d.subject)}?=\r\nMessage-ID: <${d.messageId}>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${enc(body)}`;
    const raw = btoa(mime)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const sent = await gmail(e, "messages/send", { raw }, l.email);
    d.status = "SENT";
    d.gmailId = sent.id;
    d.threadId = sent.threadId;
    d.sentAt = now();
    await put(e, "drafts", d.id, d);
    l.firstContactAt = l.firstContactAt || d.sentAt;
    l.lastContactAt = d.sentAt;
    l.stage = l.stage === "NEW" ? "CONTACTED" : l.stage;
    await saveLead(e, l);
    await put(e, "tasks", "followup-" + d.id, {
      id: "followup-" + d.id,
      title: "Review reply / next step — " + l.company,
      leadId: l.id,
      type: "FOLLOW_UP",
      due: new Date(Date.now() + 4 * 86400000).toLocaleDateString("en-CA", {
        timeZone: "Asia/Dhaka",
      }),
      status: "OPEN",
    });
    await log(
      e,
      "SENT",
      "Approved/opted-in message accepted by Gmail. Inbox delivery is not guaranteed.",
    );
    return { sent: 1 };
  } catch (err) {
    if (d.gmailId) {
      d.status = "SENT";
      d.failure = "Gmail accepted this message; local bookkeeping needs review";
      await put(e, "drafts", d.id, d);
      throw err;
    }
    d.status = "UNKNOWN";
    d.failure = "Check Gmail Sent before retry: " + safeError(err);
    await put(e, "drafts", d.id, d);
    throw err;
  }
}
function b64u(d) {
  try {
    let s = String(d).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    return new TextDecoder().decode(
      Uint8Array.from(bin, (c) => c.charCodeAt(0)),
    );
  } catch {
    return "";
  }
}
function stripHtml(h) {
  return String(h)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function extractText(p) {
  if (!p) return "";
  const parts = [];
  (function walk(x) {
    if (!x) return;
    if (x.mimeType && x.body?.data) parts.push(x);
    (x.parts || []).forEach(walk);
  })(p);
  const any =
    parts.find((x) => x.mimeType === "text/plain") ||
    parts.find((x) => String(x.mimeType).startsWith("text/"));
  if (!any) return "";
  const d = b64u(any.body.data);
  return String(any.mimeType).includes("html") ? stripHtml(d) : d;
}
async function syncReplies(e) {
  const started = Date.now();
  if (demo(e)) return { simulated: true };
  const s = await settings(e);
  if (s.autoReplyWatch === false) return { skipped: "REPLY_WATCH_OFF" };
  const sent = (await list(e, "drafts")).filter(
      (x) => x.status === "SENT" && x.threadId,
    ),
    leads = await list(e, "leads");
  if (!sent.length) return { matched: 0, stored: 0 };
  const seen = new Set((await list(e, "mail")).map((m) => m.gmailId));
  const res = await gmail(
    e,
    "messages?maxResults=20&q=" + encodeURIComponent("in:inbox newer_than:7d"),
  );
  let matched = 0,
    stored = 0;
  for (const m of res.messages || []) {
    if (Date.now() - started > 60000) break;
    if (!sent.some((d) => d.threadId === m.threadId)) continue;
    if (seen.has(m.id)) continue;
    const msg = await gmail(e, `messages/${m.id}?format=full`);
    const headers = msg.payload?.headers || [];
    if (
      headers.some(
        (x) => x.name.toLowerCase() === "auto-submitted" && x.value !== "no",
      )
    )
      continue;
    const from =
      headers.find((x) => x.name.toLowerCase() === "from")?.value || "";
    const email = from
      .match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0]
      ?.toLowerCase();
    if (email === String(e.OWNER_EMAIL || "").toLowerCase()) continue;
    const l = leads.find(
      (x) =>
        x.email?.toLowerCase() === email &&
        sent.some((d) => d.leadId === x.id && d.threadId === msg.threadId),
    );
    if (
      !l ||
      !l.firstContactAt ||
      Number(msg.internalDate) < Date.parse(l.firstContactAt)
    )
      continue;
    const at = new Date(Number(msg.internalDate)).toISOString();
    const body = extractText(msg.payload).slice(0, 8000);
    const subject =
      headers.find((x) => x.name.toLowerCase() === "subject")?.value || "";
    await put(e, "mail", m.id, {
      id: m.id,
      gmailId: m.id,
      threadId: msg.threadId,
      direction: "in",
      leadId: l.id,
      email,
      from: String(from).slice(0, 300),
      subject: String(subject).slice(0, 300),
      body,
      at,
    });
    stored++;
    if (!l.replyAt) {
      l.replyAt = at;
      l.stage = "REPLIED";
      l.replySnippet = (body || String(msg.snippet || "")).slice(0, 300);
      await saveLead(e, l);
      matched++;
    }
  }
  if (stored)
    await e.DB.prepare(
      "DELETE FROM objects WHERE kind='mail' AND rowid NOT IN (SELECT rowid FROM objects WHERE kind='mail' ORDER BY rowid DESC LIMIT 500)",
    ).run();
  await log(
    e,
    "REPLY_SYNC",
    `${matched} newly matched reply threads, ${stored} reply message(s) stored in Email activity. Limited to latest 20 inbox messages within 7 days.`,
  );
  return { matched, stored };
}
function b64utf8(t) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(t)));
}
async function mailOwner(e, subject, text) {
  if (demo(e)) return { simulated: true };
  if (!(await get(e, "credentials", "gmail")) || !e.OWNER_EMAIL)
    return { skipped: "GMAIL_NOT_CONNECTED" };
  const token = await access(e);
  const mime = `From: ${e.OWNER_EMAIL}\r\nTo: ${e.OWNER_EMAIL}\r\nSubject: =?UTF-8?B?${b64utf8(subject)}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64utf8(text)}`;
  const raw = b64utf8(mime)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const r = await externalFetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );
  if (!r.ok) throw Error("OWNER_MAIL_HTTP_" + r.status);
  return { id: (await r.json()).id };
}
async function followupDrafts(e) {
  const s = await settings(e);
  if (s.followUpOn === false) return { skipped: "FOLLOW_UP_OFF", created: 0 };
  const drafts = await list(e, "drafts"),
    leads = await list(e, "leads");
  const days = Math.max(2, Math.min(14, Number(s.followUpDays) || 4));
  const maxTouches = Math.max(1, Math.min(2, Number(s.followUpMax) || 1));
  const quietBefore = Date.now() - days * 86400000;
  const created = [];
  for (const l of leads) {
    if (!l.firstContactAt || l.replyAt) continue;
    if (l.status === "HOLD" || l.suppressed) continue;
    if (["WON", "LOST"].includes(l.stage)) continue;
    const mine = drafts.filter((d) => d.leadId === l.id);
    const sent = mine.filter((d) => ["SENT", "SIMULATED"].includes(d.status));
    if (!sent.length) continue;
    if (
      mine.some((d) =>
        ["DRAFT", "APPROVED", "SENDING", "UNKNOWN"].includes(d.status),
      )
    )
      continue;
    const touches = sent.filter((d) => d.kind === "followup").length;
    if (touches >= maxTouches) continue;
    const lastSent = Math.max(
      ...sent.map((d) => Date.parse(d.sentAt || d.simulatedAt || 0)),
    );
    if (!(lastSent < quietBefore)) continue;
    const original = sent.find((d) => d.kind !== "followup") || sent[0];
    const f = makeFollowup(l, s, days, original.subject);
    f.id = "fu-" + l.id + "-" + (touches + 1) + "-" + id().slice(0, 6);
    await put(e, "drafts", f.id, f);
    await put(e, "tasks", "followupdraft-" + f.id, {
      id: "followupdraft-" + f.id,
      title: "Review follow-up draft — " + l.company,
      leadId: l.id,
      type: "FOLLOW_UP",
      due: day(),
      status: "OPEN",
    });
    created.push(f.id);
  }
  if (created.length)
    await log(
      e,
      "FOLLOWUP",
      `${created.length} follow-up draft(s) created for quiet conversations (review before send; max ${maxTouches} extra touch(es)).`,
    );
  return { created: created.length, ids: created };
}
async function report(e, previous = false) {
  const d = previous
    ? new Date(Date.now() - 86400000).toLocaleDateString("en-CA", {
        timeZone: "Asia/Dhaka",
      })
    : day();
  if (await get(e, "reports", d)) return;
  const rows = (await list(e, "leads")).filter(
      (l) =>
        (l.sourceKind === "DISCOVERY" || demo(e)) &&
        new Date(l.createdAt).toLocaleDateString("en-CA", {
          timeZone: "Asia/Dhaka",
        }) === d,
    ),
    s = await settings(e);
  await put(e, "reports", d, {
    id: d,
    at: now(),
    counts: metrics(rows),
    target: s.dailyTarget,
    rows,
  });
  if (!demo(e) && e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_CHAT_ID) {
    const r = await externalFetch(
      `https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: e.TELEGRAM_CHAT_ID,
          text: `Daily research ${d}: ${rows.length} new rows; ${rows.filter((x) => x.status === "HOLD").length} held. Target ${s.dailyTarget}; no buyer guarantees. Private report: ${e.APP_ORIGIN}/#reports`,
        }),
      },
    );
    await log(
      e,
      r.ok ? "NOTIFIED" : "NOTIFICATION_FAILED",
      "Daily report stored. Telegram delivery attempt recorded; no blind retry.",
    );
  }
}
async function aiWrite(e, s, instruction, channel, topic) {
  if (
    !e.GEMINI_API_KEY ||
    !e.GEMINI_MODEL ||
    e.AI_FREE_CONFIRMED !== "true" ||
    demo(e)
  )
    throw Error("AI_NOT_CONNECTED_FREE_CONFIRMATION_REQUIRED");
  const r = await externalFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(e.GEMINI_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": e.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  `Write one honest social post for a ${channel} aimed at independent business owners. ` +
                  `Topic/instructions: ${instruction} (context: ${topic || "none"}). ` +
                  `Tone: practical and specific. The writer is ${s.ownerName}, a developer and analyst in Dhaka who works on ${s.skills.join(", ")}. ` +
                  `Never invent numbers, results or client names. No promises. End with the portfolio link ${s.portfolio}. Max 250 words.`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 600 },
      }),
    },
  );
  if (!r.ok) throw Error("AI_HTTP_" + r.status);
  const b = await r.json();
  if (b.candidates?.[0]?.finishReason !== "STOP") throw Error("AI_INCOMPLETE");
  const text = b.candidates[0].content.parts
    .filter((x) => x.text && !x.thought)
    .map((x) => x.text)
    .join("")
    .trim()
    .slice(0, 3000);
  if (!text) throw Error("AI_EMPTY");
  return text;
}
async function suggestions(e) {
  const s = await settings(e),
    cs = cohorts(await list(e, "leads"));
  const last = await get(e, "runtime", "ai");
  if (last && Date.now() - Date.parse(last.at) < 7 * 86400000)
    throw Error("AI_WEEKLY_COOLDOWN");
  if (
    demo(e) ||
    !e.GEMINI_API_KEY ||
    !e.GEMINI_MODEL ||
    e.AI_FREE_CONFIRMED !== "true"
  )
    throw Error("AI_NOT_CONNECTED_FREE_CONFIRMATION_REQUIRED");
  await put(e, "runtime", "ai", { at: now(), status: "ATTEMPTED" });
  const payload = {
    skills: s.skills,
    cohorts: cs.map((x) => ({
      niche: x.niche,
      contacted: x.contacted,
      replied: x.replied,
      won: x.won,
    })),
  };
  const r = await externalFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(e.GEMINI_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": e.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Suggest one small digital-services experiment using ONLY these anonymous counts. Little data means hypothesis, not learned success. No promises, diagnoses, contacts, commands or outreach authority. " +
                  JSON.stringify(payload),
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 500 },
      }),
    },
  );
  if (!r.ok) {
    let detail = "";
    try {
      const b = await r.json();
      detail =
        String(b.error?.status || "") + ": " + String(b.error?.message || "");
    } catch {}
    if (e.GEMINI_API_KEY)
      detail = detail.split(e.GEMINI_API_KEY).join("[REDACTED]");
    throw Error("AI_HTTP_" + r.status + " " + detail.slice(0, 160));
  }
  const b = await r.json();
  if (b.candidates?.[0]?.finishReason !== "STOP") throw Error("AI_INCOMPLETE");
  const text = b.candidates[0].content.parts
    .filter((x) => x.text && !x.thought)
    .map((x) => x.text)
    .join("")
    .slice(0, 2500);
  await put(e, "suggestions", id(), {
    at: now(),
    text,
    status: "Advice only; not model training",
  });
  return { ok: true };
}
async function seed(e) {
  if (!demo(e) || (await get(e, "settings", "main"))) return;
  await put(e, "settings", "main", { ...defaults, paused: false });
  for (const [i, name, niche, type, country] of [
    [
      1,
      "Northline Studio",
      "Website & WordPress",
      "Agency partner",
      "United Kingdom",
    ],
    [
      2,
      "Harbour & Pine",
      "Analytics & reporting",
      "Established business",
      "Australia",
    ],
    [
      3,
      "Mira Consulting",
      "Workflow automation",
      "Freelancer partner",
      "Bangladesh",
    ],
    [4, "Juniper Coffee", "Website & WordPress", "New business", "Canada"],
    [
      5,
      "Atlas Home Services",
      "Workflow automation",
      "Established business",
      "United States",
    ],
    [6, "Forma Collective", "Design & content", "Agency partner", "Germany"],
  ]) {
    const l = {
      id: "demo-" + i,
      sourceKind: "DEMO",
      company: name,
      website: "https://example.com",
      email: `demo${i}@example.com`,
      phone: "",
      country,
      type,
      niche,
      source: "https://example.com",
      evidence:
        "Fictional demonstration record. No actual business was researched.",
      status: i === 6 ? "HOLD" : "UNREVIEWED",
      stage: i === 2 ? "REPLIED" : i === 3 ? "WON" : "NEW",
      consent: "NONE",
      contactEvidence: "",
      createdAt: now(),
      notes: "DEMO — fictional data",
      suppressed: false,
      ...([2, 3].includes(i) ? { firstContactAt: now(), replyAt: now() } : {}),
      ...(i === 2
        ? {
            replySnippet:
              "Fictional demo reply. This seeded reply shows how Email activity stores the full matched text from your inbox.",
          }
        : {}),
    };
    await saveLead(e, l);
  }
  await put(e, "campaigns", "demo-campaign", {
    id: "demo-campaign",
    name: "UK plumbing — website fit",
    goal: "Replies",
    niche: "Website & WordPress",
    countries: ["GB"],
    status: "ACTIVE",
    startAt: now(),
    endAt: null,
  });
  const t0 = day();
  await put(e, "content", "content-demo-1", {
    id: "content-demo-1",
    date: t0,
    channel: "Facebook page",
    title: "Seasonal demand surge",
    body: "Fictional demo post. When demand spikes, your website and enquiry path decide how much of that work actually reaches you.",
    status: "POSTED",
    niche: "Website & WordPress",
    campaignId: "demo-campaign",
    metrics: { reach: 120, likes: 8, comments: 2 },
    createdAt: now(),
  });
  await put(e, "content", "content-demo-2", {
    id: "content-demo-2",
    date: t0,
    channel: "LinkedIn post",
    title: "Reporting season",
    body: "Fictional demo post. Owners ask where new customers came from and what they cost. Clean tracking answers that.",
    status: "DRAFT",
    niche: "Analytics & reporting",
    campaignId: "demo-campaign",
    metrics: { reach: 0, likes: 0, comments: 0 },
    createdAt: now(),
  });
  await put(e, "invoices", "demo-invoice", {
    id: "demo-invoice",
    leadId: "demo-3",
    amount: 15000,
    currency: "USD",
    dueAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    status: "SENT",
    note: "Fictional demo invoice",
    createdAt: now(),
  });
  for (const c of checkinPlan)
    await put(e, "tasks", "checkin-demo-3-" + c.offset, {
      id: "checkin-demo-3-" + c.offset,
      title: c.label + " — Mira Consulting",
      leadId: "demo-3",
      type: c.offset === 30 ? "RENEWAL" : "SUPPORT",
      due: new Date(Date.now() + c.offset * 86400000).toLocaleDateString(
        "en-CA",
        { timeZone: "Asia/Dhaka" },
      ),
      status: "OPEN",
    });
  await put(e, "drafts", "demo-welcome", {
    id: "demo-welcome",
    leadId: "demo-3",
    kind: "welcome",
    subject: "Welcome & next steps",
    body: "Fictional demo welcome draft.",
    status: "DRAFT",
    approvedAt: null,
    createdAt: now(),
  });
  await put(e, "drafts", "demo-sent", {
    id: "demo-sent",
    leadId: "demo-2",
    kind: "outreach",
    subject: "Would website, reporting or workflow support be relevant?",
    body: "Fictional demo outreach message.\n\nThis seeded SENT record shows how Email activity lists what went out. No real email was sent.",
    status: "SENT",
    gmailId: "demo-gmail-1",
    threadId: "demo-thread-1",
    approvedAt: now(),
    sentAt: now(),
    createdAt: now(),
  });
  await put(e, "mail", "demo-mail-1", {
    id: "demo-mail-1",
    gmailId: "demo-mail-1",
    threadId: "demo-thread-1",
    direction: "in",
    leadId: "demo-2",
    email: "demo2@example.com",
    from: "Harbour & Pine <demo2@example.com>",
    subject:
      "Re: Would website, reporting or workflow support be relevant?",
    body: "Fictional demo reply.\n\nThis seeded reply shows how Email activity stores the full matched text from your inbox.",
    at: now(),
  });
  await put(e, "tasks", "demo-task", {
    id: "demo-task",
    title: "Review homepage evidence before approving contact",
    leadId: "demo-1",
    due: day(),
    status: "OPEN",
    type: "REVIEW",
  });
  await log(
    e,
    "DEMO",
    "Preview initialized with fictional records. No external calls or messages.",
  );
}
async function state(e) {
  await seed(e);
  const leads = await list(e, "leads");
  return {
    demo: demo(e),
    settings: await settings(e),
    leads,
    drafts: await list(e, "drafts"),
    tasks: await list(e, "tasks"),
    events: await list(e, "events"),
    reports: (await list(e, "reports")).map(({ rows, ...r }) => r),
    suggestions: await list(e, "suggestions"),
    content: await list(e, "content"),
    mail: (await list(e, "mail")).map((m) => ({
      ...m,
      body: String(m.body || "").slice(0, 4000),
    })),
    runtime: {
      replySync: (await get(e, "runtime", "replySync")) || null,
      ai: (await get(e, "runtime", "ai")) || null,
    },
    campaigns: await list(e, "campaigns"),
    invoices: await list(e, "invoices"),
    digest: (await list(e, "digests"))[0] || null,
    ideas: marketingIdeas({
      leads,
      content: await list(e, "content"),
      invoices: await list(e, "invoices"),
      tasks: await list(e, "tasks"),
      day: day(),
    }),
    mapRows: businessMap,
    cohorts: cohorts(leads),
    metrics: metrics(leads),
    budget: (await get(e, "budget", day())) || {
      search: 0,
      extract: 0,
      credits: 0,
    },
    month: (await get(e, "month", day().slice(0, 7))) || { credits: 0 },
    countries: countryCodes.map((c) => ({ code: c, name: countryName(c) })),
    niches,
    connections: {
      tavily: !!e.TAVILY_API_KEY,
      gmail: !!(await get(e, "credentials", "gmail")),
      ai: !!e.GEMINI_API_KEY && e.AI_FREE_CONFIRMED === "true",
      telegram: !!e.TELEGRAM_BOT_TOKEN,
    },
    day: day(),
  };
}
async function action(e, body) {
  const s = await settings(e);
  switch (body.action) {
    case "resetDemo":
      if (!demo(e)) throw Error("Demo reset unavailable in production");
      await e.DB.batch([
        e.DB.prepare("DELETE FROM objects"),
        e.DB.prepare("DELETE FROM dedup"),
      ]);
      await seed(e);
      return { ok: true };
    case "settings":
      await put(e, "settings", "main", validSettings(body.value, s));
      await log(e, "SETTINGS", "Targeting/sending settings updated by owner.");
      break;
    case "discover":
      return discover(e, true);
    case "send":
      return sendOne(e);
    case "reconcile": {
      const d = await get(e, "drafts", body.id);
      if (!d || d.status !== "UNKNOWN" || !d.messageId)
        throw Error("No uncertain send to reconcile");
      if (demo(e)) return { simulated: true };
      const result = await gmail(
        e,
        "messages?maxResults=2&q=" +
          encodeURIComponent("in:sent rfc822msgid:" + d.messageId),
      );
      if (result.messages?.length !== 1)
        throw Error(
          "Delivery remains uncertain. No resend attempted. Inspect Gmail Sent.",
        );
      d.status = "SENT";
      d.gmailId = result.messages[0].id;
      d.threadId = result.messages[0].threadId;
      d.sentAt = d.sendingAt;
      d.failure = "Reconciled against Gmail Sent by Message-ID";
      await put(e, "drafts", d.id, d);
      const l = await get(e, "leads", d.leadId);
      if (l) {
        l.firstContactAt = l.firstContactAt || d.sentAt;
        l.lastContactAt = d.sentAt;
        await saveLead(e, l);
      }
      return { ok: true };
    }
    case "sync":
      return syncReplies(e);
    case "followup":
      return followupDrafts(e);
    case "ai":
      return suggestions(e);
    case "snapshot":
      await report(e);
      break;
    case "lead": {
      const l = await get(e, "leads", body.id);
      if (!l) throw Error("Lead not found");
      const v = body.value || {};
      if ("email" in v && v.email !== l.email) {
        if (v.consent && v.consent !== "NONE")
          throw Error(
            "Save changed email with contact basis NONE first, then record new permission",
          );
        const email = String(v.email).trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          throw Error("Invalid email");
        l.email = email;
        l.consent = "NONE";
        l.contactEvidence = "";
        l.emailSource = "Owner-entered; verify";
      }
      for (const k of ["notes", "contactEvidence", "nextActionAt"])
        if (k in v) l[k] = String(v[k]).slice(0, 2000);
      if (v.status) {
        if (!["UNREVIEWED", "APPROVED", "HOLD"].includes(v.status))
          throw Error("Invalid review status");
        l.status = v.status;
      }
      if (v.stage) {
        if (
          ![
            "NEW",
            "CONTACTED",
            "REPLIED",
            "CONVERSATION",
            "PROPOSAL",
            "NURTURE",
            "WON",
            "LOST",
          ].includes(v.stage)
        )
          throw Error("Invalid stage");
        if (v.stage === "WON" && !l.replyAt)
          throw Error(
            "A win needs a recorded reply or owner-recorded outcome first",
          );
        if (
          v.stage === "LOST" &&
          !String(v.reason || "").trim() &&
          !l.lossReason
        )
          throw Error("Record a short loss reason before marking LOST");
        if (v.stage !== l.stage)
          l.history = [
            ...(l.history || []),
            { at: now(), from: l.stage, to: v.stage },
          ].slice(-20);
        l.stage = v.stage;
        if (v.reason) l.lossReason = String(v.reason).slice(0, 200);
        if (v.stage === "WON") {
          if (!(await get(e, "tasks", "onboard-" + l.id)))
            await put(e, "tasks", "onboard-" + l.id, {
              id: "onboard-" + l.id,
              title: "Confirm scope, access and onboarding — " + l.company,
              leadId: l.id,
              type: "ONBOARDING",
              due: day(),
              status: "OPEN",
            });
          const wonAt = Date.now();
          for (const c of checkinPlan) {
            const tid = "checkin-" + l.id + "-" + c.offset;
            if (!(await get(e, "tasks", tid)))
              await put(e, "tasks", tid, {
                id: tid,
                title: c.label + " — " + l.company,
                leadId: l.id,
                type: c.offset === 30 ? "RENEWAL" : "SUPPORT",
                due: new Date(wonAt + c.offset * 86400000).toLocaleDateString(
                  "en-CA",
                  { timeZone: "Asia/Dhaka" },
                ),
                status: "OPEN",
              });
          }
          const welcomeExists = (await list(e, "drafts")).some(
            (x) => x.leadId === l.id && x.kind === "welcome",
          );
          if (!welcomeExists) {
            const wd = {
              id: id(),
              ...makeDraft(l, s, "welcome"),
              kind: "welcome",
            };
            await put(e, "drafts", wd.id, wd);
          }
          if (v.invoiceAmount !== undefined && String(v.invoiceAmount) !== "") {
            const inv = validateInvoice({
              leadId: l.id,
              amount: v.invoiceAmount,
              currency: v.invoiceCurrency || "USD",
              dueAt:
                v.invoiceDue ||
                new Date(wonAt + 14 * 86400000).toISOString().slice(0, 10),
            });
            await put(e, "invoices", inv.id, inv);
          } else if (!(await get(e, "tasks", "invoice-" + l.id))) {
            await put(e, "tasks", "invoice-" + l.id, {
              id: "invoice-" + l.id,
              title: "Record invoice — " + l.company,
              leadId: l.id,
              type: "INVOICE",
              due: day(),
              status: "OPEN",
            });
          }
        }
      }
      if (v.quote !== undefined) {
        const q = Number(v.quote);
        if ((v.quote !== "" && !Number.isFinite(q)) || q < 0 || q > 100000000)
          throw Error("Invalid quote value");
        l.quote = v.quote === "" ? null : q;
      }
      if (v.satisfaction !== undefined) {
        const n = Number(v.satisfaction);
        if (!Number.isInteger(n) || n < 1 || n > 5)
          throw Error("Satisfaction is 1–5");
        l.satisfaction = n;
      }
      if (v.consent) {
        if (!["NONE", "OPT_IN", "BUSINESS_REVIEWED"].includes(v.consent))
          throw Error("Invalid contact basis");
        if (v.consent !== "NONE" && !l.contactEvidence)
          throw Error("Record permission/lawful-basis evidence first");
        l.consent = v.consent;
      }
      if (v.suppressed === true) {
        l.suppressed = true;
        l.consent = "NONE";
        if (l.email)
          await put(e, "suppression", await hash(l.email.toLowerCase()), {
            at: now(),
          });
      }
      if (v.suppressed === false) {
        if (!l.suppressed && !(await get(e, "suppression", l.email ? await hash(l.email.toLowerCase()) : "")))
          throw Error("Contact is not currently suppressed");
        if (l.email)
          await e.DB.prepare(
            "DELETE FROM objects WHERE kind='suppression' AND id=?",
          )
            .bind(await hash(l.email.toLowerCase()))
            .run();
        l.suppressed = false;
        await put(e, "leads", l.id, l);
      }
      if (v.recordContact === true) {
        if (!l.notes || l.notes.length < 10)
          throw Error("Add notes evidencing the external contact");
        l.firstContactAt = l.firstContactAt || now();
      }
      if (v.recordReply === true) {
        if (!l.firstContactAt)
          throw Error("A reply outcome needs prior outreach evidence");
        l.replyAt = now();
        l.stage = "REPLIED";
      }
      await saveLead(e, l);
      await log(
        e,
        "REVIEW",
        "Owner updated a prospect. Contact approval is not inferred from public details.",
      );
      break;
    }
    case "draft": {
      const l = await get(e, "leads", body.id);
      if (!l || l.suppressed || l.status === "HOLD")
        throw Error("Review hold/suppression before drafting");
      const kind =
        body.kind && ["outreach", "welcome", "checkin"].includes(body.kind)
          ? body.kind
          : "outreach";
      if (
        (await list(e, "drafts")).some(
          (x) =>
            x.leadId === l.id &&
            (x.kind || "outreach") === kind &&
            ["DRAFT", "APPROVED", "SENDING", "UNKNOWN"].includes(x.status),
        )
      )
        throw Error(
          "An active draft of this type already exists for this contact",
        );
      const d = { id: id(), ...makeDraft(l, s, kind), kind };
      await put(e, "drafts", d.id, d);
      break;
    }
    case "editDraft": {
      const d = await get(e, "drafts", body.id);
      if (!d || !["DRAFT", "APPROVED"].includes(d.status))
        throw Error("This draft cannot be edited");
      d.subject = String(body.subject || "").slice(0, 160);
      d.body = String(body.body || "").slice(0, 6000);
      if (!d.subject || !d.body || /[\r\n]/.test(d.subject))
        throw Error("Invalid message");
      d.approvedAt = null;
      d.status = "DRAFT";
      await put(e, "drafts", d.id, d);
      break;
    }
    case "approve": {
      const d = await get(e, "drafts", body.id);
      if (!d || !["DRAFT", "APPROVED"].includes(d.status))
        throw Error("Message not approvable");
      const l = await get(e, "leads", d.leadId);
      const blocked = eligible(
        l,
        { ...d, approvedAt: now(), approvedEmail: l.email },
        { ...s, paused: false, autoSendOptIn: false },
      );
      if (blocked) throw Error(blocked);
      d.approvedAt = now();
      d.approvedEmail = l.email;
      d.status = "APPROVED";
      await put(e, "drafts", d.id, d);
      break;
    }
    case "task": {
      const t = {
        id: body.id || id(),
        title: String(body.title || "").slice(0, 250),
        leadId: body.leadId || "",
        due: body.due || day(),
        type: [
          "REVIEW",
          "FOLLOW_UP",
          "ONBOARDING",
          "SUPPORT",
          "RENEWAL",
          "MARKETING",
        ].includes(body.type)
          ? body.type
          : "FOLLOW_UP",
        status: body.status === "DONE" ? "DONE" : "OPEN",
      };
      if (!t.title) throw Error("Task title required");
      await put(e, "tasks", t.id, t);
      break;
    }
    case "import": {
      if ((await list(e, "leads")).length >= 2500)
        throw Error("Pilot capacity reached: archive/export first");
      if (!Array.isArray(body.rows) || body.rows.length > 100)
        throw Error("Import at most 100 rows per batch");
      let n = 0;
      for (const r of body.rows) {
        const website = String(r.Website || r.website || "");
        if (!primary(website)) continue;
        const leadId = id(),
          domain = host(website);
        const inserted = await e.DB.prepare(
          "INSERT OR IGNORE INTO dedup(domain,lead_id) VALUES(?,?) RETURNING domain",
        )
          .bind(domain, leadId)
          .first();
        if (!inserted) continue;
        const l = {
          id: leadId,
          sourceKind: "IMPORT",
          company: String(r.Company || r.company || domain).slice(0, 160),
          website,
          source: website,
          email: String(r["Public email"] || r.email || "").replace(
            /^UNKNOWN$/,
            "",
          ),
          phone: String(r["Public phone"] || r.phone || "").replace(
            /^UNKNOWN$/,
            "",
          ),
          address: String(r["Business address"] || ""),
          country: String(r["Office / market"] || r.country || "Unknown"),
          niche: niches.includes(r.Niche) ? r.Niche : niches[0],
          type: "Established business",
          status: r["Review status"] === "HOLD" ? "HOLD" : "UNREVIEWED",
          stage: "NEW",
          consent: "NONE",
          contactEvidence: "",
          suppressed: false,
          notes:
            "Imported from owner file. Previous sending/consent not inferred.",
          evidence: String(
            r["Evidence summary"] || "Owner import; verify source",
          ).slice(0, 1500),
          createdAt: now(),
        };
        await saveLead(e, l);
        n++;
      }
      return { imported: n };
    }
    case "generateContent": {
      const dateISO =
        body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : day();
      if ((await list(e, "content")).some((c) => c.date === dateISO))
        return { skipped: "already-generated", date: dateISO };
      const items = generateContent(dateISO, s, {
        leads: await list(e, "leads"),
        campaigns: await list(e, "campaigns"),
      });
      for (const it of items) await put(e, "content", it.id, it);
      await log(
        e,
        "CONTENT",
        "Generated " +
          items.length +
          " content drafts for " +
          dateISO +
          " (template-based; nothing posts without approval).",
      );
      return { generated: items.length };
    }
    case "contentConcept": {
      const concept = String(body.concept || "").trim();
      if (concept.length < 5 || concept.length > 500)
        throw Error("Concept must be 5-500 characters");
      const channel = ["LinkedIn post", "Facebook page", "X post"].includes(
        body.channel,
      )
        ? body.channel
        : "LinkedIn post";
      const s = await settings(e);
      let text = "",
        source = "template";
      if (s.contentAi) {
        try {
          text = await aiWrite(e, s, concept, channel, "");
          source = "ai";
        } catch {}
      }
      if (!text) text = contentFromConcept(concept, s, channel);
      const d = day();
      const n =
        (await list(e, "content")).filter(
          (c) => c.date === d && c.source === "concept",
        ).length + 1;
      const it = {
        id: `content-${d}-c${n}-${id().slice(0, 6)}`,
        date: d,
        channel,
        title: concept.slice(0, 60),
        body: text.slice(0, 3000),
        status: "DRAFT",
        niche: s.niche,
        topic: concept.slice(0, 200),
        concept,
        source,
        version: 1,
        campaignId:
          (await list(e, "campaigns")).find((c) => c.status === "ACTIVE")
            ?.id || null,
        metrics: { reach: 0, likes: 0, comments: 0 },
        createdAt: now(),
      };
      await put(e, "content", it.id, it);
      await log(e, "CONTENT", `New draft written from owner concept (${source}).`);
      return { ok: true, id: it.id, source };
    }
    case "content": {
      const c = await get(e, "content", body.id);
      if (!c) throw Error("Content not found");
      const v = body.value || {};
      if (v.status) {
        if (!["DRAFT", "APPROVED", "POSTED", "SKIPPED"].includes(v.status))
          throw Error("Invalid content status");
        if (v.status === "POSTED" && c.status !== "APPROVED")
          throw Error("Approve a post before marking it posted");
        c.status = v.status;
      }
      if (v.update !== undefined) {
        const instr = String(v.update).trim();
        if (instr.length < 3 || instr.length > 300)
          throw Error("Update instruction must be 3-300 characters");
        const s2 = await settings(e);
        let text = "";
        if (s2.contentAi) {
          try {
            text = await aiWrite(
              e,
              s2,
              instr,
              c.channel,
              c.topic || c.title,
            );
          } catch {}
        }
        c.body = (
          text ||
          contentFromConcept(instr, s2, c.channel)
        ).slice(0, 3000);
        c.version = (c.version || 1) + 1;
        c.status = "DRAFT";
        c.updatedWith = instr;
        await put(e, "content", c.id, c);
        await log(
          e,
          "CONTENT",
          `Post updated from owner instructions (v${c.version}); back to DRAFT.`,
        );
        return { ok: true, version: c.version };
      }
      if (v.body !== undefined) {
        c.body = String(v.body).slice(0, 3000);
        if (!c.body.trim()) throw Error("Post text cannot be empty");
        c.status = "DRAFT";
      }
      if (v.title !== undefined) {
        c.title = String(v.title).slice(0, 160);
        if (!c.title.trim()) throw Error("Title cannot be empty");
      }
      if (v.metrics) {
        for (const k of ["reach", "likes", "comments"])
          if (k in v.metrics) {
            const n = Number(v.metrics[k]);
            if (!Number.isInteger(n) || n < 0 || n > 1000000)
              throw Error("Invalid metric value");
            c.metrics[k] = n;
          }
      }
      await put(e, "content", c.id, c);
      return { ok: true };
    }
    case "campaign": {
      const v = body.value || {};
      const existing = body.id ? await get(e, "campaigns", body.id) : null;
      if (body.id && !existing) throw Error("Campaign not found");
      const c = {
        id: existing ? existing.id : id(),
        name:
          existing && !v.name
            ? existing.name
            : String(v.name || "").slice(0, 80),
        goal: [
          "Replies",
          "Booked calls",
          "Content engagement",
          "Invoices",
        ].includes(v.goal)
          ? v.goal
          : existing?.goal || "Replies",
        niche: niches.includes(v.niche) ? v.niche : existing?.niche || s.niche,
        countries: v.countries
          ? Array.from(new Set(v.countries)).filter((x) =>
              countryCodes.includes(x),
            )
          : existing?.countries || [],
        status: v.status || existing?.status || "ACTIVE",
        startAt: existing?.startAt || now(),
        endAt:
          v.end && /^\d{4}-\d{2}-\d{2}$/.test(v.end)
            ? v.end
            : existing?.endAt || null,
      };
      if (!c.name || c.name.length < 3)
        throw Error("Campaign name needs at least 3 characters");
      if (!["ACTIVE", "PAUSED", "DONE"].includes(c.status))
        throw Error("Invalid campaign status");
      await put(e, "campaigns", c.id, c);
      return { ok: true };
    }
    case "invoice": {
      const v = body.value || {};
      if (body.id) {
        const inv = await get(e, "invoices", body.id);
        if (!inv) throw Error("Invoice not found");
        if (v.status === "PAID") {
          if (inv.status === "PAID") return { ok: true, already: true };
          inv.status = "PAID";
          inv.paidAt = now();
          if (v.note) inv.note = String(v.note).slice(0, 300);
        } else if (
          v.status &&
          ["DRAFT", "SENT", "OVERDUE"].includes(v.status)
        ) {
          inv.status = v.status;
        } else if (v.status) {
          throw Error("Invalid invoice status");
        }
        if (v.amount !== undefined) {
          if (inv.status === "PAID")
            throw Error("Paid invoice amount is locked");
          const fixed = validateInvoice({
            ...inv,
            amount: v.amount,
            currency: v.currency || inv.currency,
          });
          inv.amount = fixed.amount;
          inv.currency = fixed.currency;
          inv.dueAt = fixed.dueAt;
        }
        if (v.note !== undefined && v.status !== "PAID")
          inv.note = String(v.note).slice(0, 300);
        await put(e, "invoices", inv.id, inv);
        return { ok: true };
      }
      const lead = v.leadId ? await get(e, "leads", v.leadId) : null;
      if (!lead) throw Error("Invoices need a recorded lead/customer");
      const inv = validateInvoice({
        leadId: lead.id,
        amount: v.amount,
        currency: v.currency || "USD",
        dueAt: v.dueAt,
        note: v.note,
      });
      await put(e, "invoices", inv.id, inv);
      return { id: inv.id };
    }
    case "digest":
      return { ok: true, digest: await buildDigest(e) };
    default:
      throw Error("Unknown action");
  }
  return { ok: true };
}
function validateInvoice(input) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10000000)
    throw Error("Invoice amount must be a number between 0 and 10,000,000");
  const currency = String(input.currency || "USD")
    .toUpperCase()
    .slice(0, 3);
  if (!/^[A-Z]{3}$/.test(currency)) throw Error("Currency must be 3 letters");
  const dueAt = String(input.dueAt || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueAt))
    throw Error("Invoice due date required (YYYY-MM-DD)");
  return {
    id: id(),
    leadId: input.leadId || "",
    amount,
    currency,
    dueAt,
    status:
      input.status &&
      ["DRAFT", "SENT", "PAID", "OVERDUE"].includes(input.status)
        ? input.status
        : "DRAFT",
    note: String(input.note || "").slice(0, 300),
    createdAt: now(),
  };
}
async function buildDigest(e) {
  const dhakaDate = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
  );
  const monday = new Date(
    dhakaDate.getTime() - ((dhakaDate.getDay() + 6) % 7) * 86400000,
  );
  const weekId = monday.toISOString().slice(0, 10);
  const leads = await list(e, "leads");
  const tasks = await list(e, "tasks");
  const invoices = await list(e, "invoices");
  const content = await list(e, "content");
  const customers = leads
    .filter((l) => l.stage === "WON")
    .map((l) => {
      const next = tasks
        .filter(
          (t) =>
            t.leadId === l.id &&
            t.status === "OPEN" &&
            ["SUPPORT", "RENEWAL", "FOLLOW_UP"].includes(t.type),
        )
        .sort((a, b) => a.due.localeCompare(b.due))[0];
      return {
        company: l.company,
        wonAt: l.replyAt,
        next: next ? next.due : null,
        overdue: !!(next && next.due < day()),
        satisfaction: l.satisfaction || null,
      };
    });
  const digest = {
    id: weekId,
    at: now(),
    customers,
    invoices: {
      paid: invoices
        .filter((i) => i.status === "PAID")
        .reduce((n, i) => n + i.amount, 0),
      outstanding: invoices
        .filter((i) => i.status !== "PAID")
        .reduce((n, i) => n + i.amount, 0),
      overdue: invoices.filter((i) => i.status === "OVERDUE").length,
    },
    pipeline: metrics(leads),
    content14: content.filter(
      (c) =>
        c.status === "POSTED" &&
        Date.parse(c.date + "T23:59:59Z") > Date.now() - 14 * 86400000,
    ).length,
    ideas: marketingIdeas({ leads, content, invoices, tasks, day: day() }),
  };
  await put(e, "digests", weekId, digest);
  if (!demo(e) && e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_CHAT_ID) {
    const r = await externalFetch(
      "https://api.telegram.org/bot" + e.TELEGRAM_BOT_TOKEN + "/sendMessage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: e.TELEGRAM_CHAT_ID,
          text:
            "Weekly digest " +
            weekId +
            " ready. " +
            customers.filter((c) => c.overdue).length +
            " overdue customer check-ins. Private report: " +
            e.APP_ORIGIN +
            "/#customers",
        }),
      },
    );
    await log(
      e,
      r.ok ? "NOTIFIED" : "NOTIFICATION_FAILED",
      "Weekly digest stored; Telegram notice recorded.",
    );
  }
  try {
    const d = digest;
    const lines = [
      `Weekly digest — week of ${d.id}`,
      "",
      `Customers: ${d.customers.length} (overdue check-ins: ${d.customers.filter((c) => c.overdue).length})`,
      `Pipeline: ${d.pipeline.contacted} contacted · ${d.pipeline.replied} replied${d.pipeline.replyRate === null ? "" : " (" + d.pipeline.replyRate + "%)"} · ${d.pipeline.won} won`,
      `Invoices: paid ${d.invoices.paid} · outstanding ${d.invoices.outstanding} · overdue count ${d.invoices.overdue}`,
      `Content posted in last 14 days: ${d.content14}`,
      "",
      "Ideas:",
      ...(d.ideas.length ? d.ideas.map((x) => "→ " + x.text) : ["→ Publish consistently and review honestly."]),
      "",
      `Open the workspace: ${e.APP_ORIGIN}/#reports`,
      "Owner notification only — sent to your own address, never to prospects, and it does not count against the daily send cap.",
    ];
    const r = await mailOwner(e, `Prospect Studio digest — week of ${d.id}`, lines.join("\n"));
    await log(
      e,
      r.skipped ? "DIGEST_EMAIL_SKIPPED" : "DIGEST_EMAIL",
      r.skipped
        ? "Weekly digest stored; owner email skipped (Gmail not connected)."
        : "Weekly digest emailed to the owner's own address.",
    );
  } catch (err) {
    await log(e, "DIGEST_EMAIL_ERROR", safeError(err));
  }
  return digest;
}
async function handle(r, e) {
  const u = new URL(r.url);
  if (u.pathname === "/unsubscribe") {
    return new Response(
      '<!doctype html><meta name="viewport" content="width=device-width"><title>Stop messages</title><h1>Stop future messages</h1><p>Confirm to suppress further outreach from this account.</p><form method="post" action="/api/unsubscribe?token=' +
        encodeURIComponent(u.searchParams.get("token") || "") +
        '"><button>Unsubscribe</button></form>',
      {
        headers: {
          "Content-Type": "text/html",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }
  if (u.pathname === "/api/unsubscribe" && r.method === "POST") {
    const token = u.searchParams.get("token") || "";
    const entry = await get(e, "unsubscribe", await hash(token));
    if (!entry) return json({ error: "Invalid link" }, 400);
    const l = await get(e, "leads", entry.leadId);
    const email = entry.email || l?.email?.toLowerCase();
    if (email) {
      await put(e, "suppression", await hash(email), { at: now() });
      await e.DB.prepare(
        "UPDATE objects SET data=json_set(data,'$.suppressed',json('true'),'$.consent','NONE') WHERE kind='leads' AND lower(json_extract(data,'$.email'))=?",
      )
        .bind(email)
        .run();
    }
    return new Response(
      "You are unsubscribed. Future queued outreach is blocked. A message already in flight cannot be recalled.",
    );
  }
  if (
    ["/api/auth/login", "/api/auth/callback", "/api/gmail/connect"].includes(
      u.pathname,
    )
  )
    return oauth(r, e, u);
  if (!u.pathname.startsWith("/api/")) return e.ASSETS.fetch(r);
  if (!(await authenticated(r, e)))
    return json({ error: "OWNER_SIGN_IN_REQUIRED" }, 401);
  if (u.pathname === "/api/state") return json(await state(e));
  if (u.pathname.startsWith("/api/reports/")) {
    const d = decodeURIComponent(u.pathname.split("/").pop()).replace(
      /\.xlsx$/,
      "",
    );
    const report = await get(e, "reports", d);
    if (!report) return json({ error: "Report not found" }, 404);
    return new Response(xlsx(report), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Ayaz-Prospect-Research-${d}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (u.pathname === "/api/export/mail.xlsx") {
    const leads = await list(e, "leads");
    const name = (id) => leads.find((x) => x.id === id)?.company || "Unknown";
    const sent = (await list(e, "drafts"))
      .filter((d) => ["SENT", "SIMULATED"].includes(d.status))
      .sort((a, b) => String(a.sentAt || "").localeCompare(String(b.sentAt || "")));
    const inbox = (await list(e, "mail")).sort((a, b) =>
      String(a.at || "").localeCompare(String(b.at || "")),
    );
    return new Response(
      xlsxBook([
        {
          name: "Sent",
          header: ["When", "Business", "Address", "Subject", "Kind", "Status", "Body (first 500)"],
          rows: sent.map((d) => {
            const l = leads.find((x) => x.id === d.leadId);
            return [
              d.sentAt || d.simulatedAt || "",
              name(d.leadId),
              l?.email || "",
              d.subject || "",
              d.kind || "outreach",
              d.status,
              String(d.body || "").slice(0, 500),
            ];
          }),
        },
        {
          name: "Received",
          header: ["When", "Business", "From", "Subject", "Body (first 500)"],
          rows: inbox.map((m) => [
            m.at || "",
            name(m.leadId),
            m.from || m.email || "",
            m.subject || "",
            String(m.body || "").slice(0, 500),
          ]),
        },
      ]),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="Prospect-Studio-Email-Activity-${day()}.xlsx"`,
          "Cache-Control": "no-store",
        },
      },
    );
  }
  if (u.pathname === "/api/export/backup.json") {
    const kinds = [
      "settings",
      "leads",
      "drafts",
      "mail",
      "tasks",
      "content",
      "campaigns",
      "invoices",
      "digests",
      "suggestions",
      "events",
      "unsubscribe",
      "suppression",
      "sends",
    ];
    const data = {};
    for (const k of kinds) data[k] = await list(e, k);
    data.reports = (await list(e, "reports")).map(({ rows: _, ...r }) => r);
    return new Response(
      JSON.stringify(
        {
          app: "Prospect Studio",
          version: "0.4.0",
          exportedAt: now(),
          note: "Full owner backup. Encrypted credentials are deliberately excluded — reconnect Gmail through the app after any restore. Unsent drafts, suppression and reply evidence are included.",
          objects: data,
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="Prospect-Studio-Backup-${day()}.json"`,
          "Cache-Control": "no-store",
        },
      },
    );
  }
  if (r.method !== "POST") return json({ error: "Not found" }, 404);
  if (!demo(e) && r.headers.get("Origin") !== e.APP_ORIGIN)
    return json({ error: "ORIGIN_REJECTED" }, 403);
  if (Number(r.headers.get("Content-Length") || 0) > 300000)
    return json({ error: "Body too large" }, 413);
  const text = await r.text();
  if (text.length > 300000) return json({ error: "Body too large" }, 413);
  const body = JSON.parse(text);
  if (body.action === "logout") {
    const sid = cookie(r, "ps_session");
    if (sid)
      await e.DB.prepare("DELETE FROM sessions WHERE id=?")
        .bind(await hash(sid))
        .run();
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie":
          "ps_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
      },
    });
  }
  if (
    body.action === "settings" &&
    body.value?.paused === true &&
    Object.keys(body.value).length === 1
  ) {
    const current = await settings(e);
    await put(e, "settings", "main", { ...current, paused: true });
    return json({ ok: true });
  }
  const ticket = await lease(e);
  try {
    return json(await action(e, body));
  } finally {
    await release(e, ticket);
  }
}
export default {
  async fetch(r, e) {
    try {
      return await handle(r, e);
    } catch (err) {
      return json({ error: safeError(err) }, 400);
    }
  },
  async scheduled(event, e, ctx) {
    if (demo(e)) return;
    ctx.waitUntil(
      (async () => {
        let ticket;
        try {
          ticket = await lease(e);
        } catch {
          return;
        }
        try {
          const s = await settings(e);
          if (s.paused) return;
          for (const task of [() => discover(e), () => sendOne(e), () => followupDrafts(e)]) {
            try {
              await task();
            } catch (err) {
              await log(e, "STOPPED", safeError(err));
            }
          }
          const last = await get(e, "runtime", "replySync");
          if (
            s.autoReplyWatch !== false &&
            (await get(e, "credentials", "gmail")) &&
            (!last || Date.now() - last.at > 3600000)
          ) {
            await put(e, "runtime", "replySync", { at: Date.now() });
            try {
              await syncReplies(e);
            } catch (err) {
              await log(e, "REPLY_SYNC_ERROR", safeError(err));
            }
          }
          if (s.autoContent !== false) {
            const today = day();
            if (!(await list(e, "content")).some((c) => c.date === today)) {
              try {
                const items = generateContent(today, s, {
                  leads: await list(e, "leads"),
                  campaigns: await list(e, "campaigns"),
                });
                for (const it of items) await put(e, "content", it.id, it);
                await log(
                  e,
                  "CONTENT",
                  "Automatic daily content drafts created (review before posting).",
                );
              } catch (err) {
                await log(e, "CONTENT_ERROR", safeError(err));
              }
            }
          }
          for (const inv of await list(e, "invoices"))
            if (inv.status !== "PAID" && inv.dueAt && inv.dueAt < day()) {
              inv.status = "OVERDUE";
              await put(e, "invoices", inv.id, inv);
            }
          const dow = Number(
            new Intl.DateTimeFormat("en-US", {
              timeZone: "Asia/Dhaka",
              weekday: "short",
            }).format(new Date()),
          );
          if (dow === 0) {
            try {
              await buildDigest(e);
            } catch (err) {
              await log(e, "DIGEST_ERROR", safeError(err));
            }
          }
          const hour = Number(
            new Intl.DateTimeFormat("en-GB", {
              timeZone: "Asia/Dhaka",
              hour: "2-digit",
              hour12: false,
            }).format(new Date()),
          );
          if (hour < 1) {
            await report(e, true);
            const ai = await get(e, "runtime", "ai");
            if (
              e.GEMINI_API_KEY &&
              e.GEMINI_MODEL &&
              e.AI_FREE_CONFIRMED === "true" &&
              (!ai || Date.now() - Date.parse(ai.at) > 7 * 86400000)
            ) {
              try {
                await suggestions(e);
              } catch (err) {
                await log(e, "AI_ERROR", safeError(err));
              }
            }
          }
        } finally {
          await release(e, ticket);
        }
      })(),
    );
  },
};
