let S,
  view = location.hash.slice(1) || "overview",
  search = "",
  filter = "all",
  mailFilter = "all";
const app = document.querySelector("#app"),
  drawer = document.querySelector("#drawer");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ],
  );
const icons = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  prospects:
    "M3 21v-3a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v3 M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M17 4a4 4 0 0 1 0 7 M19 14a5 5 0 0 1 3 5",
  review: "M5 3h14v18H5z M8 8l2 2 5-5 M8 15h8",
  mail: "M3 5h18v14H3z M3 6l9 7 9-7",
  automation: "M13 2 4 14h6l-1 8 9-12h-6l1-8z",
  pipeline: "M4 5h16 M4 12h10 M4 19h5 M19 9v10m-3-3 3 3 3-3",
  customers: "M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  tasks: "M9 5h12 M9 12h12 M9 19h12 M2 5l2 2 3-4 M2 12l2 2 3-4 M2 19l2 2 3-4",
  reports: "M4 3v18h17 M8 17v-5 M13 17V7 M18 17V4",
  settings:
    "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2v4 M12 18v4 M2 12h4 M18 12h4 M5 5l3 3 M16 16l3 3 M5 19l3-3 M16 8l3-3",
  marketing: "M3 11l14-6v14L3 13v-2z M17 8a4 4 0 0 1 0 8 M20 5a8 8 0 0 1 0 14",
  finance: "M12 3v18 M5 8h8a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h11",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14",
};
const names = {
  overview: "Overview",
  prospects: "Prospects",
  review: "Review & send",
  mail: "Email activity",
  pipeline: "Sales pipeline",
  customers: "Customers",
  marketing: "Marketing",
  finance: "Finance",
  tasks: "Work & follow-ups",
  reports: "Reports & learning",
  map: "Business map",
  automation: "Automation",
  settings: "Settings",
};
const icon = (k) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[k] || icons.overview}"/></svg>`;
const badge = (t, c = "") => `<span class="badge ${c}">${esc(t)}</span>`;
const date = (t) =>
  t
    ? new Date(t).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "—";
const safeURL = (u) => {
  try {
    return new URL(u).protocol === "https:" ? u : "#";
  } catch {
    return "#";
  }
};
function toast(t) {
  const a = document.querySelector("#toast");
  a.textContent = t;
  a.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (a.style.display = "none"), 7000);
}
async function api(body) {
  const r = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
async function load() {
  const r = await fetch("/api/state");
  if (r.status === 401) {
    app.innerHTML = `<section class="login card"><img class="login-logo" src="/logo.png" alt="Prospect Studio" width="320" /><h1>Your private growth workspace.</h1><p class="muted">Research, review and follow through. Sign in with the configured owner’s Google account.</p><a href="/api/auth/login"><button class="primary">Continue with Google</button></a><p class="footnote">Owner-only access. No prospect messages are sent by signing in.</p></section>`;
    return;
  }
  const data = await r.json();
  if (!r.ok) throw Error(data.error);
  S = data;
  render();
}
async function act(body, success = "Saved") {
  try {
    const result = await api(body);
    await load();
    toast(
      result.simulated
        ? "Demo only: no external action was performed."
        : success,
    );
    return result;
  } catch (e) {
    toast(e.message);
    return null;
  }
}
function shell(content) {
  return `<div class="layout"><aside class="sidebar"><div class="brand"><img class="brand-mark" src="/mark.png" alt="" width="35" height="35"><span>Prospect Studio</span></div><div class="nav-label">YOUR WORKSPACE</div><nav class="nav">${Object.entries(
    names,
  )
    .map(
      ([k, n]) =>
        `<a href="#${k}" class="${view === k ? "active" : ""}">${icon(k)}${n}</a>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-bottom"><div class="row"><span class="badge green">FREE-TIER PILOT</span></div><p style="margin-top:12px">Deliberate outreach.<br>Better conversations.</p><div class="owner"><div class="avatar">FA</div><div>Fozayel Ibn Ayaz<br><small style="color:#a8bec5">Owner workspace</small></div></div></div></aside><main class="main"><header class="topbar"><div class="crumb">Workspace &nbsp; / &nbsp; <strong>${names[view] || "Overview"}</strong></div><div class="row">${badge(S.settings.paused ? "Paused" : "Worker enabled", S.settings.paused ? "amber" : "green")}<span class="muted" style="font-size:12px">Asia / Dhaka</span><button data-act="pause">${S.settings.paused ? "Resume" : "Pause all"}</button><div class="avatar">FA</div></div></header><div class="content">${S.demo ? '<div class="notice"><strong>INTERACTIVE DEMO</strong> · Fictional records. Changes persist only in this local preview. No discovery, email or AI provider calls. Do not import private data here.</div>' : '<div class="notice">Private pilot · Free quotas apply. Source matches are not verified buying interest. Review evidence before contact.</div>'}${content}<p class="footnote">Public contact details ≠ permission or demand. Automatic sending requires recorded opt-in. Replies, suppression and daily caps take priority.</p></div></main></div>`;
}
function headline(eyebrow, title, sub, buttons = "") {
  return `<div class="headline"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${sub}</p></div><div class="row">${buttons}</div></div>`;
}
function stats() {
  return `<div class="grid stats">${[
    [
      "Research prospects",
      S.metrics.total,
      "Includes imported records; not qualified buyers",
    ],
    [
      "Contact details available",
      S.metrics.contactable,
      "Unverified email · excludes held records",
    ],
    [
      "Recorded replies",
      S.metrics.replied,
      "Matched or owner-recorded contact outcomes",
    ],
    [
      "Recorded customers",
      S.metrics.won,
      "Won with contact and reply evidence",
    ],
  ]
    .map(
      ([a, b, c]) =>
        `<section class="card"><div class="stat-label">${a}</div><div class="stat-value">${b}</div><div class="stat-note">${c}</div></section>`,
    )
    .join("")}</div>`;
}
function modes() {
  return `<div class="mode-box">${[
    [
      "broad",
      "Broad discovery",
      "Rotate all listed countries and prospect types.",
    ],
    [
      "focused",
      "Focused targeting",
      "Use your selected markets and business types.",
    ],
    [
      "adaptive",
      "Outcome-adaptive",
      "Use reply cohorts, with exploration preserved.",
    ],
  ]
    .map(
      ([m, t, d]) =>
        `<button class="mode ${S.settings.mode === m ? "active" : ""}" data-mode="${m}" aria-pressed="${S.settings.mode === m}"><strong>${t}</strong><small>${d}</small></button>`,
    )
    .join("")}</div>`;
}
function table(leads) {
  return `<div class="table-wrap"><table><thead><tr><th>Business / prospect</th><th>Market</th><th>Service fit</th><th>Review</th><th>Actions</th></tr></thead><tbody>${leads
    .map(
      (l) =>
        `<tr><td><div class="company"><span class="monogram">${esc(
          l.company
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join(""),
        )}</span><div><strong>${esc(l.company)}</strong><small>${esc(l.type || "Business")}</small></div></div></td><td>${esc(l.country)}</td><td>${esc(l.niche)}</td><td>${badge(l.suppressed ? "SUPPRESSED" : l.status, l.status === "HOLD" ? "amber" : l.status === "APPROVED" ? "green" : "")}</td><td><button class="text-button" data-lead="${esc(l.id)}">Review ↗</button></td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div>${!leads.length ? '<div class="empty"><strong>No matching prospects yet</strong>Run discovery after connecting Tavily, or import your existing research.</div>' : ""}`;
}
function attention() {
  const chips = [];
  const approvedUnsent = S.drafts.filter((d) => d.status === "APPROVED").length;
  const unknown = S.drafts.filter((d) => d.status === "UNKNOWN").length;
  const contentDrafts = S.content.filter((c) => c.status === "DRAFT").length;
  const toAnswer = S.leads.filter(
    (l) =>
      ["REPLIED", "CONVERSATION"].includes(l.stage) &&
      !["WON", "LOST"].includes(l.stage),
  ).length;
  const overdue = S.tasks.filter(
    (t) => t.status === "OPEN" && t.due && t.due < S.day,
  ).length;
  if (approvedUnsent)
    chips.push({
      n: approvedUnsent,
      label: "approved message(s) ready to send",
      nav: "review",
    });
  if (unknown)
    chips.push({ n: unknown, label: "uncertain send(s) to reconcile", nav: "review" });
  if (contentDrafts)
    chips.push({ n: contentDrafts, label: "content draft(s) to review", nav: "marketing" });
  if (toAnswer)
    chips.push({ n: toAnswer, label: "conversation(s) to answer", nav: "pipeline" });
  if (overdue) chips.push({ n: overdue, label: "overdue task(s)", nav: "tasks" });
  if (!chips.length) return "";
  return `<section class="attention"><span class="muted" style="font-size:12px">NEEDS YOUR EYES:</span>${chips.map((c) => `<a href="#${c.nav}" class="chip">${c.n} ${c.label} →</a>`).join("")}</section>`;
}
function overview() {
  return (
    headline(
      "A SMALLER PIPELINE. BETTER OPPORTUNITIES.",
      "Good work starts with the right conversation.",
      "A single place to discover, review and grow your independent business.",
      `<button data-act="discover">↻ Run discovery</button><button class="primary" data-nav="review">Review queue →</button>`,
    ) +
    attention() +
    stats() +
    `<div class="grid columns"><section class="card"><div class="card-head"><h2>Discovery direction</h2>${badge(S.settings.mode.toUpperCase(), "green")}</div><p class="muted" style="font-size:12px">Your skills lead the search. You decide how wide to look.</p>${modes()}<div class="pill-row">${S.settings.skills.map((x) => `<span class="pill">${esc(x)}</span>`).join("")}</div><div class="coverage"><div class="coverage-label"><strong>${S.settings.mode === "focused" ? S.settings.focusCountries.length : S.countries.length} markets</strong><span>Eligible for rotation · not all researched today</span></div></div></section><section class="card"><div class="card-head"><h2>Automation & limits</h2>${badge("NO PAID FALLBACK")}</div><label class="switch"><input type="checkbox" data-toggle="autoSendOptIn" ${S.settings.autoSendOptIn ? "checked" : ""}><span><strong>Auto-send opted-in</strong><small>${S.settings.autoSendOptIn ? "Eligible opted-in drafts may send automatically." : "Off · every message waits for your approval."}</small></span></label><div class="divider"></div>${[
      ["Search attempts", S.budget.search, 8],
      ["Extraction batches", S.budget.extract, 20],
      ["Monthly reserved credits", S.month.credits, 900],
    ]
      .map(
        ([t, n, max]) =>
          `<div class="quota-row"><div class="row"><span>${t}</span><strong>${n} / ${max}</strong></div><div class="meter"><span style="width:${Math.min(100, (n / max) * 100)}%"></span></div></div>`,
      )
      .join(
        "",
      )}<p class="muted" style="font-size:11px;margin-bottom:0">24/7 clock, bounded work. Target ${S.settings.dailyTarget} research candidates/day; shortages stay visible.</p></section></div><div class="grid columns bottom-grid"><section class="card table-card"><div class="card-head"><h2>Prospects to review</h2><button class="text-button" data-nav="prospects">View all →</button></div>${table(S.leads.filter((x) => x.status === "UNREVIEWED").slice(0, 4))}</section><section class="card"><div class="card-head"><h2>Activity ledger</h2><span class="muted caps">RECENT</span></div>${
      S.events
        .slice(0, 4)
        .map(
          (e) =>
            `<div class="event"><span class="event-icon">↗</span><div><p>${esc(e.message)}</p><small>${esc(e.type)} · ${date(e.at)}</small></div></div>`,
        )
        .join("") || '<div class="empty">Worker events will appear here.</div>'
    }</section></div>`
  );
}
function prospects() {
  const rows = S.leads.filter(
    (l) =>
      (l.company + " " + l.country + " " + l.niche)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" || l.status === filter),
  );
  return (
    headline(
      "RESEARCH, NOT ASSUMPTIONS",
      "Your prospect library",
      "Business owners, new businesses, agencies, freelancers and public work requests.",
      `<label class="file-label">Import CSV / JSON<input id="import" type="file" accept=".csv,.json"></label><button class="primary" data-act="discover">Run discovery</button>`,
    ) +
    `<div class="toolbar"><input aria-label="Search prospects" id="search" type="search" placeholder="Search business, country or service…" value="${esc(search)}"><select id="filter" aria-label="Review filter">${["all", "UNREVIEWED", "APPROVED", "HOLD"].map((v) => `<option value="${v}" ${filter === v ? "selected" : ""}>${v === "all" ? "All review states" : v}</option>`).join("")}</select></div><section class="card table-card">${table(rows)}</section><p class="notes">Import your existing Google Sheet as CSV. Imports are deduplicated and do not count as new discovery. Consent and past outcomes are not inferred from imported text.</p>`
  );
}
function review() {
  return (
    headline(
      "YOU CONTROL THE SEND",
      "Review & send",
      "A draft is not permission. Review the recipient, source, contact basis and exact message.",
      `<button data-act="sync">Sync Gmail replies</button><button class="primary" data-act="send">Process one eligible message</button>`,
    ) +
    `<section class="card" style="margin-bottom:20px"><label class="switch"><input type="checkbox" data-toggle="autoSendOptIn" ${S.settings.autoSendOptIn ? "checked" : ""}><span><strong>Auto-send opted-in: ${S.settings.autoSendOptIn ? "ON" : "OFF"}</strong><small>On: recorded opt-in only. Off: every message needs approval. Suppressed contacts never send.</small></span></label></section><div class="grid two">${
      S.drafts
        .map((d) => {
          const l = S.leads.find((x) => x.id === d.leadId);
          return `<section class="card"><div class="card-head"><h2>${esc(l?.company || "Unknown contact")}</h2>${d.kind === "followup" ? badge("FOLLOW-UP", "amber") + " " : d.kind === "invoice-reminder" ? badge("INVOICE", "amber") + " " : ""}${badge(d.status, d.status === "SENT" ? "green" : d.status === "UNKNOWN" ? "red" : "")}</div><p class="muted">To: ${esc(l?.email || "No email")} · ${esc(l?.consent || "NONE")}</p><strong>${esc(d.subject)}</strong><p class="message">${esc(d.body)}</p>${d.failure ? `<p class="notice">${esc(d.failure)}</p>` : ""}${d.status === "UNKNOWN" ? `<button data-reconcile="${esc(d.id)}">Check Gmail Sent (no resend)</button>` : ""}<div class="row"><button data-editdraft="${esc(d.id)}" ${!["DRAFT", "APPROVED"].includes(d.status) ? "disabled" : ""}>Edit message</button><button data-approve="${esc(d.id)}" ${!["DRAFT", "APPROVED"].includes(d.status) ? "disabled" : ""}>Approve this message</button><button class="text-button" data-lead="${esc(d.leadId)}">Contact evidence</button></div></section>`;
        })
        .join("") ||
      '<section class="card wide empty"><strong>Your review queue is clear</strong>Open a prospect, review its evidence, then create a draft. No messages are silently generated or sent from a search result.<p><button data-nav="prospects">Open prospects →</button></p></section>'
    }</div>`
  );
}
function mailData() {
  const out = S.drafts
    .filter((d) => d.status === "SENT" || (S.demo && d.status === "SIMULATED"))
    .map((d) => {
      const l = S.leads.find((x) => x.id === d.leadId);
      return {
        dir: "out",
        id: "out-" + d.id,
        at: d.sentAt || d.sendingAt || d.approvedAt || "",
        who: l?.company || "Unknown contact",
        email: l?.email || "",
        subject: d.subject || "",
        body: d.body || "",
        leadId: d.leadId,
      };
    });
  const inn = (S.mail || []).map((m) => {
    const l = S.leads.find((x) => x.id === m.leadId);
    return {
      dir: "in",
      id: "in-" + m.gmailId,
      at: m.at || "",
      who: m.from || (l ? l.company : "Unknown sender"),
      email: m.email || l?.email || "",
      subject: m.subject || "",
      body: m.body || "",
      leadId: m.leadId,
    };
  });
  const all = [...out, ...inn]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 200);
  return { out, inn, all };
}
function mailView() {
  const { out, inn, all } = mailData();
  const rows = all.filter((x) => mailFilter === "all" || x.dir === mailFilter);
  return (
    headline(
      "EVERY CONVERSATION, ON RECORD",
      "Email activity",
      "Which message went out, which reply came back, and exactly what it said. Sent lines come from your sent drafts; replies are matched to their thread by the worker.",
      `<button data-act="sync">Sync Gmail replies</button>`,
    ) +
    `<div class="row" style="margin-bottom:14px">${[
      ["all", "All " + all.length],
      ["out", "Sent " + out.length],
      ["in", "Received " + inn.length],
    ]
      .map(
        ([k, label]) =>
          `<button class="${mailFilter === k ? "primary" : ""}" data-mailfilter="${k}">${label}</button>`,
      )
      .join("")}</div>` +
    `<section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Direction</th><th>Business / contact</th><th>Subject</th><th>When</th><th><span class="sr-only">Open message</span></th></tr></thead><tbody>${
      rows
        .map(
          (m) =>
            `<tr style="cursor:pointer" data-mail="${esc(m.id)}"><td>${badge(m.dir === "out" ? "→ SENT" : "← REPLY", m.dir === "out" ? "green" : "amber")}</td><td><div><strong>${esc(m.who)}</strong><small>${esc(m.email)}</small></div></td><td>${esc(m.subject)}</td><td>${date(m.at)}</td><td><button class="text-button">Read →</button></td></tr>`,
        )
        .join("") ||
      `<tr><td colspan="5"><div class="empty"><strong>No email activity yet</strong>Approved messages appear here as soon as they are sent. Replies matched from your Gmail inbox appear within an hour (worker) or after “Sync Gmail replies”.</div></td></tr>`
    }</tbody></table></div><p class="footnote">Outbound copies include the unsubscribe footer the recipient sees. Replies are stored only when they match a thread you sent — nothing else from the inbox is read or saved.</p></section>`
  );
}
function mailModal(m) {
  modal(
    `<h2>${m.dir === "in" ? "Received reply" : "Sent message"}</h2><p class="muted">${m.dir === "in" ? "From" : "To"}: ${esc(m.who)}${m.email && m.email !== m.who ? ` (${esc(m.email)})` : ""} · ${m.at ? new Date(m.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) + " Dhaka" : "—"} · ${esc(m.subject)}</p><pre class="mail-body">${esc(m.body)}</pre>${m.leadId ? `<button data-lead="${esc(m.leadId)}">Open lead review</button>` : ""}<p class="footnote">${m.dir === "in" ? "Full text of the matched reply, stored when the worker read it." : "This is the exact message (with unsubscribe footer) that was sent. Nothing is posted or sent from this view."}</p>`,
  );
}
function pipeline() {
  const stages = [
    "NEW",
    "CONTACTED",
    "REPLIED",
    "CONVERSATION",
    "PROPOSAL",
    "NURTURE",
    "WON",
    "LOST",
  ];
  return (
    headline(
      "FOLLOW THE RELATIONSHIP",
      "Sales pipeline",
      "Review a card to move its stage. Stage changes do not fabricate contact or reply evidence.",
    ) +
    `<div class="board">${stages
      .map(
        (stage) =>
          `<section class="lane"><h3>${stage} · ${S.leads.filter((l) => l.stage === stage).length}</h3>${S.leads
            .filter((l) => l.stage === stage)
            .map(
              (l) =>
                `<article class="lead-card"><strong>${esc(l.company)}</strong><small>${esc(l.niche)}</small>${badge(l.status, l.status === "HOLD" ? "amber" : "")}<p><button class="text-button" data-lead="${esc(l.id)}">Review relationship →</button></p></article>`,
            )
            .join("")}</section>`,
      )
      .join("")}</div>`
  );
}
function customers() {
  const ls = S.leads.filter((x) => x.stage === "WON");
  const d = S.digest;
  return (
    headline(
      "AFTER THE YES",
      "Customer success",
      "Automatic day-1 / day-7 / day-30 check-ins, a weekly digest and recorded satisfaction. An overdue task is an attention signal—not a churn prediction.",
      `<button data-act="digest">Build weekly digest</button><button class="primary" data-act="newTask">Add customer task</button>`,
    ) +
    (d
      ? `<section class="card" style="margin-bottom:20px"><div class="card-head"><h2>Weekly digest — week of ${esc(d.id)}</h2>${badge("RECORDED DATA")}</div><div class="grid four" style="grid-template-columns:repeat(4,1fr);gap:14px">${[
          [d.customers.filter((c) => c.overdue).length, "overdue check-ins"],
          [d.invoices.overdue, "overdue invoices"],
          [d.content14, "posts (14 days)"],
          [d.pipeline.won, "recorded wins"],
        ]
          .map(
            ([n, t]) =>
              `<div><div class="stat-value" style="font-size:26px;margin:6px 0 2px">${n}</div><small>${esc(t)}</small></div>`,
          )
          .join(
            "",
          )}</div><p class="muted" style="font-size:12px;margin-top:14px">${d.ideas.map((x) => "• " + esc(x.text)).join("<br>") || "No alerts this week."}</p></section>`
      : "") +
    `<div class="grid two">${
      ls
        .map((l) => {
          const openTasks = S.tasks
            .filter((t) => t.leadId === l.id && t.status === "OPEN")
            .sort((a, b) => a.due.localeCompare(b.due));
          const next = openTasks[0];
          return `<section class="card"><div class="card-head"><h2>${esc(l.company)}</h2>${badge(l.firstContactAt && l.replyAt ? "RECORDED WIN" : "NEEDS EVIDENCE", "green")}</div><p class="muted">${esc(l.niche)}</p><p>Next check-in: ${next ? esc(next.title) + " · " + esc(next.due) : "None scheduled"}</p><p>Satisfaction: ${[1, 2, 3, 4, 5].map((n) => `<button class="${l.satisfaction === n ? "primary" : ""}" style="padding:5px 9px;margin-right:5px" data-satisfaction="${esc(l.id)}:${n}">${n}</button>`).join("")}${l.satisfaction ? `<small>${l.satisfaction}/5 recorded</small>` : ""}</p><p>${esc(l.notes || "Add authorised customer context and service milestones.")}</p><div class="row"><button data-lead="${esc(l.id)}">Open customer</button><button data-draftkind="${esc(l.id)}:checkin">Check-in draft</button><button data-tasklead="${esc(l.id)}">Add task</button></div></section>`;
        })
        .join("") ||
      '<section class="card empty wide"><strong>No recorded customers yet</strong>Move a real customer to WON after the sale. The app then creates onboarding, check-in and invoice tasks automatically. Never treat a discovered business as a customer.</section>'
    }</div><section class="card" style="margin-top:20px"><h2>Behaviour & churn boundaries</h2><p class="muted">This release tracks recorded replies, stages, follow-up dates, satisfaction scores and service tasks. It does not ingest product analytics, payment activity or usage telemetry. No churn score is invented without those first-party data sources.</p></section>`
  );
}
function marketing() {
  const items = S.content
    .filter((c) => c.date === S.day)
    .sort((a, b) => a.id.localeCompare(b.id));
  return (
    headline(
      "DAILY CONTENT, COORDINATED PUSH",
      "Marketing center",
      "The app auto-drafts content every day from your topics and skills. You approve, edit, post and record results. No paid ads anywhere.",
      `<button class="primary" data-act="generateContent">Generate today’s content</button>`,
    ) +
    `<div class="grid two" style="margin-bottom:20px"><section class="card"><div class="card-head"><h2>Content autopilot</h2>${badge(S.settings.autoContent === false ? "OFF" : "ON", S.settings.autoContent === false ? "" : "green")}</div><label class="switch"><input type="checkbox" id="autoContentT" ${S.settings.autoContent === false ? "" : "checked"}><span><strong>Daily autopilot</strong><small>Writes drafts at the first worker wake of the day. Nothing posts without your approval.</small></span></label><div class="detail-grid" style="margin-top:12px"><label class="field">Posts per day (1–10)<input id="contentCount" type="number" min="1" max="10" value="${S.settings.contentCount}"></label></div><label class="field">Topics (one per line — optional “ID: topic” form)<textarea id="contentTopics" rows="4" placeholder="GA4 for clinics&#10;T2: WordPress maintenance plans&#10;Reporting dashboards for owner-operators">${esc(S.settings.contentTopics || "")}</textarea></label><label class="switch"><input type="checkbox" id="contentAiT" ${S.settings.contentAi ? "checked" : ""}><span><strong>AI writer (Gemini, when connected)</strong><small>Off or unavailable → the honest template writer is used instead.</small></span></label><button class="primary" id="saveAutopilot">Save autopilot</button><p class="footnote">With topics set, the daily run writes exactly the number above, rotating through your topics and channels.</p></section><section class="card"><h2>Write from concept</h2><p class="muted" style="font-size:12px">Share a topic, a topic ID or a loose idea — the app writes a new draft for you to review. You can also update any existing post with fresh instructions.</p><label class="field">Your concept<textarea id="conceptBox" rows="4" placeholder="e.g. T1: why local clinics lose enquiries at 8pm, and the 20-minute fix"></textarea></label><div class="detail-grid"><label class="field">Channel<select id="conceptChannel"><option>LinkedIn post</option><option>Facebook page</option><option>X post</option></select></label></div><button class="primary" id="writeConcept">Write draft from concept</button><p class="footnote">Concepts become DRAFT posts. Nothing is published automatically.</p></section></div><div class="grid columns"><section class="card"><h2>Today’s content drafts</h2>${
      items
        .map(
          (c) =>
            `<div class="connected"><div class="row spread"><strong>${esc(c.title)}</strong>${badge(c.status, c.status === "POSTED" ? "green" : c.status === "APPROVED" ? "green" : "")}<small>${esc(c.channel)}</small></div>${
              c.topic
                ? `<div class="muted" style="font-size:11px;margin-top:2px">Topic: ${esc(c.topic)}${c.source === "concept" ? " · from your concept" : ""} · v${c.version || 1}</div>`
                : ""
            }<p class="message">${esc(c.body)}</p>${
              c.status === "DRAFT" || c.status === "APPROVED"
                ? `<div class="row"><button data-updatecontent="${esc(c.id)}">Update</button><button data-editcontent="${esc(c.id)}">Edit</button><button data-approvecontent="${esc(c.id)}">Approve</button><button data-postcontent="${esc(c.id)}" ${c.status !== "APPROVED" ? "disabled" : ""}>Mark posted</button><button class="danger" data-skipcontent="${esc(c.id)}">Skip</button></div>`
                : ""
            }${
              c.status === "POSTED"
                ? `<div class="row" style="margin-top:10px"><label class="field" style="margin:0;width:120px">Reach<input type="number" min="0" value="${c.metrics.reach}" data-metric-reach="${esc(c.id)}"></label><label class="field" style="margin:0;width:120px">Likes<input type="number" min="0" value="${c.metrics.likes}" data-metric-likes="${esc(c.id)}"></label><label class="field" style="margin:0;width:120px">Comments<input type="number" min="0" value="${c.metrics.comments}" data-metric-comments="${esc(c.id)}"></label><button data-savemetrics="${esc(c.id)}">Save metrics</button></div>`
                : ""
            }</div>`,
        )
        .join("") ||
      '<div class="empty"><strong>Nothing generated for today yet</strong>Run Generate, or wait for the automatic morning draft. Nothing is posted without your approval.</div>'
    }</section><div><section class="card"><h2>Campaigns</h2>${S.campaigns.map((c) => `<div class="connected"><div class="row spread"><strong>${esc(c.name)}</strong>${badge(c.status, c.status === "ACTIVE" ? "green" : "")}</div><small>${esc(c.goal)} · ${esc(c.niche)}${c.countries.length ? " · " + c.countries.join(", ") : ""}</small><div class="row" style="margin-top:10px"><button data-editcampaign="${esc(c.id)}">Edit</button><button data-togglecampaign="${esc(c.id)}">${c.status === "ACTIVE" ? "Pause" : "Activate"}</button></div></div>`).join("") || '<div class="empty">No campaigns yet. A campaign coordinates content and outreach toward one goal.</div>'}<button data-act="newCampaign">New campaign</button><p class="footnote">Campaigns are organic pushes. Paid ad platforms are outside this free system.</p></section><section class="card" style="margin-top:20px"><h2>Marketing ideas</h2>${S.ideas.map((x) => `<p class="connected" style="font-size:12px"><strong>→</strong> ${esc(x.text)}</p>`).join("") || '<p class="muted">Ideas appear as your recorded outcomes accumulate. Until then: publish consistently and review honestly.</p>'}<p class="footnote">Rule-based from your recorded data. Small samples are labelled. Ideas never auto-post or auto-send.</p></section><section class="card" style="margin-top:20px"><h2>Channel reality</h2><p class="notes">LinkedIn: there is no free official API for automated personal-profile posting, so the app produces approved copy you paste (two minutes). Facebook/X: optional later connectors after your own app setup; not included in this release. No channel automation that breaks platform rules or costs money.</p></section></div></div>`
  );
}
function finance() {
  const inv = S.invoices;
  const paid = inv
    .filter((i) => i.status === "PAID")
    .reduce((n, i) => n + i.amount, 0);
  const out = inv
    .filter((i) => i.status !== "PAID")
    .reduce((n, i) => n + i.amount, 0);
  const open = S.leads
    .filter(
      (l) =>
        ["PROPOSAL", "NURTURE", "CONVERSATION"].includes(l.stage) && l.quote,
    )
    .reduce((n, l) => n + l.quote, 0);
  return (
    headline(
      "RECORDED, NOT INVENTED",
      "Finance",
      "Invoices, payments and pipeline value from your recorded data. Money moves externally—bKash, bank or card. The app records; it never processes payments.",
      `<button class="primary" data-act="newInvoice">New invoice</button>`,
    ) +
    `<div class="grid stats">${[
      [
        "Collected (recorded paid)",
        paid.toLocaleString(),
        "Sum of invoices you marked PAID.",
      ],
      ["Outstanding", out.toLocaleString(), "Unpaid invoice value."],
      [
        "Open pipeline quotes",
        open.toLocaleString(),
        "Quoted value in proposal, conversation and nurture stages.",
      ],
      ["Recorded wins", S.metrics.won, "With contact and reply evidence."],
    ]
      .map(
        ([a, b, c]) =>
          `<section class="card"><div class="stat-label">${a}</div><div class="stat-value">${b}</div><div class="stat-note">${c}</div></section>`,
      )
      .join(
        "",
      )}</div><section class="card table-card"><div class="card-head"><h2>Invoices</h2></div><div class="table-wrap"><table><thead><tr><th>Customer</th><th>Amount</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>${inv
      .map((i) => {
        const l = S.leads.find((x) => x.id === i.leadId);
        const overdue = i.status !== "PAID" && i.dueAt && i.dueAt < S.day;
        return `<tr><td><strong>${esc(l?.company || "—")}</strong><br><small>${esc(i.note || "")}</small>${i.reminderSentAt ? `<br><small class="muted">Reminder sent ${date(i.reminderSentAt)}</small>` : ""}</td><td>${i.amount.toLocaleString()} ${esc(i.currency)}</td><td>${esc(i.dueAt)}</td><td>${badge(i.status, i.status === "PAID" ? "green" : i.status === "OVERDUE" ? "red" : "")}</td><td><div class="row">${i.status !== "PAID" ? `<button data-payinvoice="${esc(i.id)}">Record payment</button>` : ""}${overdue ? `<button data-invreminder="${esc(i.id)}">Reminder draft</button>` : ""}</div></td></tr>`;
      })
      .join(
        "",
      )}</tbody></table></div>${!inv.length ? '<div class="empty">No invoices yet. The app suggests an invoice when a lead becomes WON.</div>' : ""}</section><p class="notes">This is bookkeeping, not accounting software and not tax advice. Invoices are created for wins; you record payment when money actually arrives.</p>`
  );
}
function bmap() {
  return (
    headline(
      "A-TO-Z",
      "Business map",
      "Every stage a small service business runs—and exactly where this app stands at each, today. No marketing blur.",
    ) +
    `<section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Stage</th><th>What people do</th><th>Status</th><th>How it works here</th></tr></thead><tbody>${S.mapRows.map((r) => `<tr><td><strong>${esc(r.stage)}</strong></td><td>${esc(r.people)}</td><td>${badge(r.status, r.status === "BUILT" || r.status === "REVIEW GATED" ? "green" : r.status === "PARTIAL" || r.status === "GUARDED" || r.status === "NEEDS DATA" ? "amber" : "red")}</td><td>${esc(r.note)}</td></tr>`).join("")}</tbody></table></div></section><p class="notes">Scope grows in stages with QA between them. “NEEDS DATA” means the capability is real only once you connect authorised first-party data; “NOT FREE” is excluded by design.</p>`
  );
}
function tasks() {
  return (
    headline(
      "KEEP YOUR PROMISES",
      "Work & follow-ups",
      "One reviewable board for nurture, marketing tasks, onboarding, support and renewals.",
      `<button class="primary" data-act="newTask">＋ New task</button>`,
    ) +
    `<section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Task</th><th>Type</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>${S.tasks.map((t) => `<tr><td><strong>${esc(t.title)}</strong><br><small>${esc(S.leads.find((l) => l.id === t.leadId)?.company || "Workspace")}</small></td><td>${badge(t.type)}</td><td>${esc(t.due)}</td><td>${badge(t.status, t.status === "DONE" ? "green" : t.due < S.day ? "amber" : "")}</td><td>${t.status !== "DONE" ? `<button data-donetask="${esc(t.id)}">Mark done</button>` : ""}</td></tr>`).join("")}</tbody></table></div>${!S.tasks.length ? '<div class="empty">No tasks. Add a follow-up or service milestone.</div>' : ""}</section><p class="notes">Tasks do not send messages or publish posts. Prepare a draft separately and apply your sending policy. Overdue tasks remain visible until completed.</p>`
  );
}
function reports() {
  return (
    headline(
      "EVIDENCE BEFORE CONFIDENCE",
      "Reports & learning",
      "Reply rates use contacted prospects—not your entire research list.",
      `<a href="/api/export/mail.xlsx"><button>Email activity XLSX</button></a><a href="/api/export/backup.json"><button>Full backup JSON</button></a><button data-act="snapshot">Create today’s snapshot</button>`,
    ) +
    `<div class="grid columns"><section class="card"><div class="card-head"><h2>Which offers get responses?</h2>${badge("OBSERVATIONAL")}</div>${S.cohorts.map((c) => `<div class="quota-row"><div class="row"><strong>${esc(c.niche)}</strong><span>${c.replied} / ${c.contacted} replied</span></div><div class="meter"><span style="width:${c.replyRate || 0}%"></span></div><small>${esc(c.evidence)} · ${c.won} recorded wins</small></div>`).join("")}<p class="notes">Adaptive mode needs at least 10 contacted prospects in a niche. It uses smoothed reply rates and retains ${S.settings.adaptiveExplore}% exploration. All recorded replies count, including negative replies. Review wins/losses too. This is a routing heuristic, not model training or proof of causation.</p></section><section class="card"><h2>Daily XLSX reports</h2><p class="muted" style="font-size:12px">The clock stores the previous Dhaka day after midnight. Download a private XLSX without Google Sheets.</p>${S.reports.map((r) => `<div class="connected row spread"><div><strong>${esc(r.id)}</strong><br><small>${r.counts.total} rows · as of ${date(r.at)}</small></div><a href="/api/reports/${encodeURIComponent(r.id)}.xlsx"><button>Download XLSX</button></a></div>`).join("") || '<div class="empty">No snapshots yet.</div>'}<p class="footnote">Snapshots are immutable. A manual same-day snapshot can omit records added later that day.</p></section><section class="card wide"><h2>AI suggestions</h2>${S.suggestions.map((x) => `<p class="message">${esc(x.text)}</p><small>${esc(x.status)} · ${date(x.at)}</small>`).join("") || '<p class="muted">Not connected or no suggestions yet. The app’s transparent outcome rules work without AI. Optional Gemini receives only approved skill tags and anonymous niche counts—never contacts, emails, replies or private notes.</p>'}<p class="footnote">Run it any time with “Ask AI” in Automation. One anonymous request per week.</p></section><section class="card wide"><h2>Restore from backup</h2><p class="muted" style="font-size:12px">Upload a backup JSON you downloaded from this app. Preview first — nothing is written until you press Restore, and credentials are never restored.</p><label class="file-label">Backup file (.json)<input id="restoreFile" type="file" accept=".json,application/json"></label><div class="detail-grid"><label class="field">Mode<select id="restoreMode"><option value="add">Add missing records only (safest)</option><option value="update">Replace existing records with the backup version</option></select></label></div><div class="row"><button id="restorePreview">Preview restore</button><button class="primary" id="restoreApply">Restore now</button></div><div id="restoreResult"></div><p class="footnote">Restores leads, drafts, replies, tasks, content, campaigns, invoices, settings, suppression and audit events. Snapshots restore as records only (their row detail lives in the XLSX you already downloaded), and Gmail stays connected through the app, never through a file.</p></section></div>`
  );
}
function pauseWindowNow() {
  const txt = String(S.settings.pauseWindows || "");
  const today = S.day;
  for (const raw of txt.split(/\r?\n/)) {
    const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})(?:\s*\.\.\s*(\d{4}-\d{2}-\d{2}))?$/);
    if (!m) continue;
    const from = m[1],
      to = m[2] || m[1];
    if (today >= from && today <= to) return { from, to };
  }
  return null;
}
function automationView() {
  const s = S.settings;
  const win = pauseWindowNow();
  const lastEv = (t) =>
    [...(S.events || [])].reverse().find((x) => x.type === t)?.at || null;
  const suppressed = S.leads.filter((l) => l.suppressed).length;
  const topics = String(s.contentTopics || "")
    .split(/\r?\n/)
    .filter((x) => x.trim()).length;
  const rows = [
    {
      name: "Discovery",
      what: `Finds real business candidates 24/7 (${s.mode} mode, ${s.dailyTarget}/day target). Search ${S.budget.search}/8 · extraction ${S.budget.extract}/20 today.`,
      status: s.paused ? "OFF" : "ON",
      color: s.paused ? "" : "green",
      last: null,
      action: { act: "discover", label: "Run discovery now" },
    },
    {
      name: "Outreach sending",
      what: `Cap ${s.dailySendLimit}/day. ${s.autoSendOptIn ? "Auto-sends recorded opt-in only." : "Every message waits for your approval."} Suppressed contacts never send.`,
      status: s.paused
        ? "OFF"
        : win
          ? `PAUSED (window until ${win.to})`
          : s.autoSendOptIn
            ? "AUTO · OPT-IN"
            : "APPROVAL",
      color: s.paused || win ? "" : s.autoSendOptIn ? "green" : "amber",
      last: lastEv("SENT"),
      action: { act: "send", label: "Process one eligible message" },
    },
    {
      name: "Invoice reminders",
      what:
        s.invoiceRemindersOn === false
          ? "Off."
          : "Drafts a polite reminder for each overdue unpaid invoice (max 2, 7 days apart). Review-gated like every message.",
      status: s.invoiceRemindersOn === false ? "OFF" : "ON",
      color: s.invoiceRemindersOn === false ? "" : "green",
      last: lastEv("INVOICE_REMINDER"),
      action: { act: "invoiceReminders", label: "Draft reminders now" },
    },
    {
      name: "Reply watch",
      what: "Matches replies to your sent threads from Gmail and stores the full text in Email activity.",
      status: s.autoReplyWatch === false ? "OFF" : "ON",
      color: s.autoReplyWatch === false ? "" : "green",
      last: S.runtime?.replySync?.at || null,
      action: { act: "sync", label: "Sync now" },
    },
    {
      name: "Daily content",
      what:
        s.autoContent === false
          ? "Autopilot off."
          : `Writes ${s.contentCount} post drafts/day (${topics ? topics + " of your topics" : "template topics"}). AI writer ${s.contentAi ? "on" : "off"}.`,
      status: s.autoContent === false ? "OFF" : "ON",
      color: s.autoContent === false ? "" : "green",
      last: lastEv("CONTENT"),
      action: { act: "generateContent", label: "Generate today’s content" },
    },
    {
      name: "Follow-up autopilot",
      what:
        s.followUpOn === false
          ? "Off."
          : `Drafts one gentle follow-up when a conversation goes quiet for ${s.followUpDays} days (max ${s.followUpMax} extra touch${s.followUpMax > 1 ? "es" : ""}, never after a reply).`,
      status: s.followUpOn === false ? "OFF" : "ON",
      color: s.followUpOn === false ? "" : "green",
      last: lastEv("FOLLOWUP"),
      action: { act: "followup", label: "Run follow-ups now" },
    },
    {
      name: "Reports & digest",
      what: "Nightly report after midnight Dhaka · Sunday digest · immutable XLSX downloads.",
      status: "ON",
      color: "green",
      last: S.reports[0]?.at || null,
      action: { act: "snapshot", label: "Create snapshot" },
    },
    {
      name: "AI assist",
      what: `Optional Gemini, free tier, owner-confirmed. ${S.connections.ai ? "Connected." : "Not connected — rule-based features work without it."}`,
      status: S.connections.ai ? "CONNECTED" : "NOT CONNECTED",
      color: S.connections.ai ? "green" : "",
      last: S.runtime?.ai?.at || null,
      action: S.connections.ai ? { act: "ai", label: "Ask AI" } : null,
    },
    {
      name: "Compliance guards",
      what: `${suppressed} suppressed contact(s) · per-message unsubscribe link · individual approval gate · daily caps · replies and suppression always win.`,
      status: "ALWAYS ON",
      color: "green",
      last: null,
      action: null,
    },
  ];
  return (
    headline(
      "IT RUNS. YOU OVERSEE.",
      "Automation",
      "Every worker on one screen: what it does, whether it is on, when it last ran, and a button to run it now. Nothing here sends without your approval rules or posts without your sign-off.",
      `<button data-act="pause">${s.paused ? "Resume all" : "Pause all"}</button>`,
    ) +
    `<section class="card">${rows
      .map(
        (r) =>
          `<div class="auto-row"><div><strong>${r.name}</strong><p class="muted" style="font-size:12px;margin:4px 0">${esc(r.what)}</p>${r.last ? `<small class="muted">Last run: ${date(r.last)}</small>` : ""}</div><div class="row" style="flex-shrink:0;flex-direction:column;align-items:flex-end;gap:8px">${badge(r.status, r.color)}${r.action ? `<button data-act="${r.action.act}">${r.action.label}</button>` : ""}</div></div>`,
      )
      .join("")}</section><section class="card" style="margin-top:20px"><h2>Follow-up &amp; money settings</h2><label class="switch"><input type="checkbox" id="followUpOnT" ${s.followUpOn === false ? "" : "checked"}><span><strong>Follow-up autopilot</strong><small>One honest nudge after silence, and a second only if you allow it. Never after a reply, never for held or suppressed contacts.</small></span></label><div class="detail-grid" style="margin-top:12px"><label class="field">Wait days before follow-up (2–14)<input id="followUpDays" type="number" min="2" max="14" value="${s.followUpDays}"></label><label class="field">Extra touches per prospect (1–2)<input id="followUpMax" type="number" min="1" max="2" value="${s.followUpMax}"></label></div><label class="switch" style="margin-top:12px"><input type="checkbox" id="invoiceRemindersT" ${s.invoiceRemindersOn === false ? "" : "checked"}><span><strong>Invoice reminders</strong><small>For overdue unpaid invoices: a polite draft, max twice, a week apart. Always a draft for your approval.</small></span></label><label class="field" style="margin-top:12px">Outreach pause windows <small>One per line, e.g. 2026-12-20..2027-01-03 — sending, follow-ups and reminders pause; research and reports continue</small><textarea id="pauseWindows" rows="3" placeholder="2026-12-20..2027-01-03">${esc(s.pauseWindows || "")}</textarea></label><button class="primary" id="saveFollowup">Save follow-up settings</button><p class="footnote">Drafts land in Review &amp; send tagged FOLLOW-UP or INVOICE, with a task on the Work board. Every one still needs your approval unless your auto-send opt-in setting applies.</p></section><p class="notes">The worker wakes every 15 minutes: discovery → send queue → follow-ups → invoice reminders → hourly reply watch. Once a day it drafts content. After midnight Dhaka it stores the report; Sunday it builds the digest and emails it to you. “Pause all” stops everything at once.</p>`
  );
}
function settingsView() {
  return (
    headline(
      "MAKE IT YOUR WORKSPACE",
      "Settings & connections",
      "Credentials stay on the server. No more daily Script Properties or spreadsheet operation.",
    ) +
    `<div class="grid two"><section class="card"><h2>Targeting controls</h2>${modes()}<form id="settingsForm"><label class="field">Focused countries <small>Hold Cmd/Ctrl to select multiple</small><select multiple name="focusCountries">${S.countries.map((c) => `<option value="${c.code}" ${S.settings.focusCountries.includes(c.code) ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label><label class="field">Focused prospect types<select multiple name="focusTypes">${["Established business", "New business", "Agency partner", "Freelancer partner", "Public work request"].map((t) => `<option ${S.settings.focusTypes.includes(t) ? "selected" : ""}>${t}</option>`).join("")}</select></label><label class="field">Focused service<select name="niche">${S.niches.map((n) => `<option ${n === S.settings.niche ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label><div class="detail-grid"><label class="field">Daily research target (1–50)<input name="dailyTarget" type="number" min="1" max="50" value="${S.settings.dailyTarget}"></label><label class="field">Send attempts/day (1–20)<input name="dailySendLimit" type="number" min="1" max="20" value="${S.settings.dailySendLimit}"></label></div><label class="field">Adaptive exploration %<input name="adaptiveExplore" type="number" min="1" max="100" value="${S.settings.adaptiveExplore}"></label><button class="primary">Save targeting</button></form></section><div><section class="card"><div class="card-head"><h2>Account connections</h2><button data-act="logout">Sign out</button></div>${[
      ["Tavily", "tavily", "Search + extraction; free-account check"],
      ["Gmail", "gmail", "Owner-approved / opted-in mail and matched replies"],
      ["Gemini", "ai", "Optional anonymous weekly advice"],
      ["Telegram", "telegram", "Owner daily-report notifications"],
    ]
      .map(
        ([n, k, d]) =>
          `<div class="connected"><div class="row spread"><strong>${n}</strong>${badge(S.connections[k] ? "CONFIGURED" : "NOT CONNECTED", S.connections[k] ? "green" : "amber")}</div><small>${d}</small>${k === "gmail" ? '<p><a href="/api/gmail/connect"><button>Connect Gmail securely</button></a></p>' : ""}</div>`,
      )
      .join(
        "",
      )}<p class="footnote">Configured does not mean live-verified. Server secrets are entered once during deployment using Wrangler—not embedded in the website.</p></section><section class="card" style="margin-top:20px"><h2>Sending policy</h2><label class="switch"><input type="checkbox" data-toggle="autoSendOptIn" ${S.settings.autoSendOptIn ? "checked" : ""}><span><strong>Auto-send opted-in</strong><small>OFF requires individual message approval.</small></span></label><p class="notes" style="margin-top:20px">Manual business outreach requires a recorded, reviewed permitted basis and individual approval. Public availability alone is not consent. New drafts stop on replies; suppression always wins. Unknown send results are never retried blindly.</p></section></div></div>`
  );
}
function render() {
  if (!names[view]) view = "overview";
  app.innerHTML = shell(
    {
      overview,
      prospects,
      review,
      mail: mailView,
      pipeline,
      customers,
      marketing,
      finance,
      tasks,
      reports,
      map: bmap,
      automation: automationView,
      settings: settingsView,
    }[view](),
  );
  bind();
}
function modal(html) {
  drawer.innerHTML = `<button class="close" aria-label="Close dialog">×</button>${html}`;
  drawer.querySelector(".close").onclick = () => drawer.close();
  drawer.showModal();
}
function leadModal(id) {
  const l = S.leads.find((x) => x.id === id);
  if (!l) return;
  modal(
    `<div class="eyebrow">PROSPECT EVIDENCE</div><h2>${esc(l.company)}</h2><div class="row">${badge(l.type)}${badge(l.niche)}</div><div class="detail-grid" style="margin-top:22px">${[
      ["Website", l.website],
      ["Country / market", l.country],
      ["Public email", l.email || "Unknown"],
      ["Email source", l.emailSource || "Not established"],
      ["Public phone", l.phone || "Unknown"],
      ["Phone source", l.phoneSource || "Not established"],
      ["Business address", l.address || "Unknown"],
      ["Named contact", l.person || "Unknown"],
    ]
      .map(
        ([a, b]) =>
          `<p><small>${a}</small>${a === "Website" ? `<a href="${esc(safeURL(b))}" target="_blank" rel="noopener noreferrer">${esc(b)}</a>` : esc(b)}</p>`,
      )
      .join(
        "",
      )}</div><p class="notes">${esc(l.evidence)}<br><strong>Fit hypothesis only. No audited defect, budget, buying intent or deliverability is implied.</strong></p>${l.replySnippet ? `<p class="message">Latest matched reply: ${esc(l.replySnippet)}</p>` : ""}<form id="leadForm"><div class="detail-grid"><label class="field">Review status<select name="status">${["UNREVIEWED", "APPROVED", "HOLD"].map((v) => `<option ${v === l.status ? "selected" : ""}>${v}</option>`).join("")}</select></label><label class="field">Relationship stage<select name="stage">${["NEW", "CONTACTED", "REPLIED", "CONVERSATION", "PROPOSAL", "NURTURE", "WON", "LOST"].map((v) => `<option ${v === l.stage ? "selected" : ""}>${v}</option>`).join("")}</select></label></div><label class="field">Business email (changing it requires permission review)<input name="email" type="email" value="${esc(l.email || "")}"></label><label class="field">Contact basis<select name="consent">${[
      ["NONE", "None — draft only"],
      ["OPT_IN", "Explicit opt-in recorded"],
      [
        "BUSINESS_REVIEWED",
        "Individually reviewed permitted business contact — manual only",
      ],
    ]
      .map(
        ([v, t]) =>
          `<option value="${v}" ${v === l.consent ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="field">Permission / lawful-contact evidence<textarea name="contactEvidence" placeholder="Where, when and what they agreed to—or the reviewed basis and jurisdiction for this specific manual message.">${esc(l.contactEvidence)}</textarea></label><label class="field">Owner notes<textarea name="notes">${esc(l.notes)}</textarea></label><label class="field">Next action date<input type="date" name="nextActionAt" value="${esc(l.nextActionAt?.slice(0, 10) || "")}"></label><div class="detail-grid"><label class="field">Quote value (number)<input name="quote" type="number" min="0" step="any" value="${esc(l.quote || "")}"></label><label class="field">Loss reason (required when LOST)<input name="reason" value="${esc(l.lossReason || "")}" maxlength="200"></label></div><label class="field">Invoice on win — amount (optional)<input name="invoiceAmount" type="number" min="0" step="any" placeholder="Leave empty to create a task instead"></label><label class="field">Invoice currency<input name="invoiceCurrency" value="${esc((l.invoice && l.invoice.currency) || "USD")}" maxlength="3"></label><div class="form-actions"><button type="button" class="${l.suppressed ? "primary" : "danger"}" id="suppress">${l.suppressed ? "Restore contact" : "Suppress contact"}</button><button class="primary">Save review</button></div></form><div class="divider"></div><div class="row"><button id="draftLead">Create draft</button><button id="checkinLead">Check-in draft</button><button id="recordContact">Record external contact</button><button id="recordReply">Record received reply</button></div>`,
  );
  drawer.querySelector("#leadForm").onsubmit = async (e) => {
    e.preventDefault();
    const value = Object.fromEntries(new FormData(e.target));
    if (await act({ action: "lead", id, value }, "Review saved"))
      drawer.close();
  };
  drawer.querySelector("#suppress").onclick = async () => {
    if (l.suppressed) {
      if (
        await act(
          { action: "lead", id, value: { suppressed: false } },
          "Contact restored — re-record permission evidence and approval before sending",
        )
      )
        drawer.close();
      return;
    }
    if (
      confirm(
        "Suppress this contact from all future app outreach? You can restore it later.",
      )
    ) {
      if (
        await act(
          { action: "lead", id, value: { suppressed: true } },
          "Contact suppressed",
        )
      )
        drawer.close();
    }
  };
  drawer.querySelector("#recordContact").onclick = async () => {
    if (
      confirm(
        "Record an actual external contact? Save evidence in Owner notes first.",
      )
    ) {
      if (
        await act(
          { action: "lead", id, value: { recordContact: true } },
          "External contact recorded",
        )
      )
        drawer.close();
    }
  };
  drawer.querySelector("#recordReply").onclick = async () => {
    if (confirm("Record a reply actually received from this contact?")) {
      if (
        await act(
          { action: "lead", id, value: { recordReply: true } },
          "Reply recorded",
        )
      )
        drawer.close();
    }
  };
  drawer.querySelector("#checkinLead").onclick = async () => {
    if (
      await act(
        { action: "draft", id, kind: "checkin" },
        "Check-in draft created. Nothing sent.",
      )
    ) {
      drawer.close();
      location.hash = "review";
    }
  };
  drawer.querySelector("#draftLead").onclick = async () => {
    if (await act({ action: "draft", id }, "Draft created. Nothing sent.")) {
      drawer.close();
      location.hash = "review";
    }
  };
}
function draftModal(id) {
  const d = S.drafts.find((x) => x.id === id);
  modal(
    `<h2>Edit message</h2><p class="muted">Editing clears previous approval.</p><form id="draftForm"><label class="field">Subject<input name="subject" value="${esc(d.subject)}" required maxlength="160"></label><label class="field">Message<textarea name="body" style="min-height:280px" required maxlength="6000">${esc(d.body)}</textarea></label><button class="primary">Save draft</button></form>`,
  );
  drawer.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    if (
      await act(
        {
          action: "editDraft",
          id,
          ...Object.fromEntries(new FormData(e.target)),
        },
        "Draft saved; approval cleared",
      )
    )
      drawer.close();
  };
}
function taskModal(leadId = "") {
  modal(
    `<h2>New work item</h2><form><label class="field">Title<input name="title" required maxlength="250"></label><label class="field">Type<select name="type">${["REVIEW", "FOLLOW_UP", "ONBOARDING", "SUPPORT", "RENEWAL", "MARKETING"].map((x) => `<option>${x}</option>`).join("")}</select></label><label class="field">Prospect / customer<select name="leadId"><option value="">Workspace task</option>${S.leads.map((l) => `<option value="${esc(l.id)}" ${l.id === leadId ? "selected" : ""}>${esc(l.company)}</option>`).join("")}</select></label><label class="field">Due<input type="date" name="due" value="${S.day}" required></label><button class="primary">Create task</button></form>`,
  );
  drawer.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    if (
      await act(
        { action: "task", ...Object.fromEntries(new FormData(e.target)) },
        "Task created",
      )
    )
      drawer.close();
  };
}
function parseCSV(t) {
  const rows = [];
  let row = [],
    s = "",
    quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '"') {
      if (quoted && t[i + 1] === '"') {
        s += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(s.replace(/\r$/, ""));
      s = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else s += c;
  }
  row.push(s.replace(/\r$/, ""));
  if (row.some(Boolean)) rows.push(row);
  const heads = (rows.shift() || []).map((x) => x.replace(/^\uFEFF/, ""));
  return rows.map((row) =>
    Object.fromEntries(heads.map((h, i) => [h, row[i] || ""])),
  );
}
function campaignModal(existingId) {
  const c = existingId ? S.campaigns.find((x) => x.id === existingId) : null;
  modal(
    `<h2>${c ? "Edit campaign" : "New campaign"}</h2><form id="campaignForm"><label class="field">Name<input name="name" required maxlength="80" value="${esc(c?.name || "")}"></label><label class="field">Goal<select name="goal">${["Replies", "Booked calls", "Content engagement", "Invoices"].map((g) => `<option ${c?.goal === g ? "selected" : ""}>${g}</option>`).join("")}</select></label><label class="field">Service focus<select name="niche">${S.niches.map((n) => `<option ${(c?.niche || S.settings.niche) === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label><label class="field">Markets (optional — hold Cmd/Ctrl for multiple)<select multiple name="countries" style="height:130px">${S.countries.map((x) => `<option value="${x.code}" ${(c?.countries || []).includes(x.code) ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label class="field">End date (optional)<input type="date" name="end" value="${esc(c?.endAt?.slice(0, 10) || "")}"></label><button class="primary">Save campaign</button></form>`,
  );
  drawer.querySelector("#campaignForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (
      await act(
        {
          action: "campaign",
          id: c?.id,
          value: {
            name: f.get("name"),
            goal: f.get("goal"),
            niche: f.get("niche"),
            countries: f.getAll("countries"),
            end: f.get("end") || undefined,
          },
        },
        "Campaign saved",
      )
    )
      drawer.close();
  };
}
function contentModal(id) {
  const c = S.content.find((x) => x.id === id);
  if (!c) return;
  modal(
    `<h2>Edit post</h2><p class="muted">${esc(c.channel)} · ${esc(c.title)}</p><form id="contentForm"><label class="field">Title<input name="title" required maxlength="160" value="${esc(c.title)}"></label><label class="field">Post text<textarea name="body" required maxlength="3000" style="min-height:260px">${esc(c.body)}</textarea></label><p class="footnote">Editing returns the post to DRAFT. Nothing is posted automatically.</p><button class="primary">Save post</button></form>`,
  );
  drawer.querySelector("#contentForm").onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    if (await act({ action: "content", id, value: v }, "Post saved as draft."))
      drawer.close();
  };
}
function updateContentModal(id) {
  const c = S.content.find((x) => x.id === id);
  if (!c) return;
  modal(
    `<h2>Update post</h2><p class="muted">${esc(c.channel)} · v${c.version || 1} · ${esc(c.title)}</p><p class="notes">Share the new angle or instruction — the app rewrites the post and returns it to DRAFT for your review.</p><form id="updateForm"><label class="field">New instructions<textarea name="update" required minlength="3" maxlength="300" style="min-height:120px" placeholder="e.g. Focus this on small clinics; mention after-hours enquiries; keep it under 120 words"></textarea></label><p class="footnote">v${c.version || 1} → v${(c.version || 1) + 1}. Nothing is posted automatically.</p><button class="primary">Rewrite post</button></form>`,
  );
  drawer.querySelector("#updateForm").onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    if (
      await act(
        { action: "content", id, value: { update: v.update } },
        "Post rewritten — back in DRAFT for your review.",
      )
    )
      drawer.close();
  };
}
function invoiceModal() {
  const eligibleLeads = S.leads.filter(
    (l) =>
      l.stage === "WON" ||
      l.stage === "LOST" ||
      ["PROPOSAL", "NURTURE", "CONVERSATION", "REPLIED"].includes(l.stage),
  );
  modal(
    `<h2>New invoice</h2><form id="invoiceForm"><label class="field">Customer / lead<select name="leadId" required><option value="">Choose…</option>${eligibleLeads.map((l) => `<option value="${esc(l.id)}">${esc(l.company)} — ${l.stage}</option>`).join("")}</select></label><div class="detail-grid"><label class="field">Amount<input name="amount" type="number" min="0" step="any" required></label><label class="field">Currency<input name="currency" value="USD" maxlength="3" required></label></div><label class="field">Due date<input type="date" name="dueAt" required></label><label class="field">Note<textarea name="note" maxlength="300" placeholder="Scope, reference or agreement — your words."></textarea></label><button class="primary">Create invoice (DRAFT)</button></form><p class="footnote">Creating an invoice never sends anything. Record PAID only when money actually arrives.</p>`,
  );
  drawer.querySelector("#invoiceForm").onsubmit = async (e) => {
    e.preventDefault();
    if (
      await act(
        {
          action: "invoice",
          value: Object.fromEntries(new FormData(e.target)),
        },
        "Invoice created as draft.",
      )
    )
      drawer.close();
  };
}
function bind() {
  document
    .querySelectorAll("[data-reconcile]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          act(
            { action: "reconcile", id: b.dataset.reconcile },
            "Delivery reconciled",
          )),
    );
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => (b.onclick = () => (location.hash = b.dataset.nav)));
  document
    .querySelectorAll("[data-lead]")
    .forEach((b) => (b.onclick = () => leadModal(b.dataset.lead)));
  document
    .querySelectorAll("[data-mode]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          act(
            { action: "settings", value: { mode: b.dataset.mode } },
            "Targeting mode updated",
          )),
    );
  document.querySelectorAll("[data-toggle]").forEach(
    (b) =>
      (b.onchange = async () => {
        if (
          b.checked &&
          !confirm(
            "Enable automatic sending ONLY for recorded opted-in contacts, within caps?",
          )
        ) {
          b.checked = false;
          return;
        }
        await act(
          { action: "settings", value: { [b.dataset.toggle]: b.checked } },
          "Sending policy updated",
        );
      }),
  );
  document.querySelectorAll("[data-act]").forEach(
    (b) =>
      (b.onclick = async () => {
        const a = b.dataset.act;
        if (a === "newTask") return taskModal();
        if (a === "newCampaign") return campaignModal();
        if (a === "newInvoice") return invoiceModal();
        b.disabled = true;
        if (a === "pause")
          await act(
            { action: "settings", value: { paused: !S.settings.paused } },
            "Worker state updated",
          );
        else if (a === "followup" || a === "invoiceReminders") {
          const r = await act({ action: a }, "Run finished.");
          if (r && r.created !== undefined)
            toast(
              r.created
                ? `${r.created} ${a === "followup" ? "follow-up" : "invoice reminder"} draft(s) created — review them in Review & send.`
                : r.skipped === "PAUSE_WINDOW"
                  ? `Outreach is inside a pause window until ${r.window?.to || "the window ends"}.`
                  : r.skipped
                    ? "That autopilot is off."
                    : a === "followup"
                      ? "No quiet conversations needed a follow-up yet."
                      : "No overdue invoice needed a reminder draft.",
            );
        } else
          await act(
            { action: a },
            a === "discover"
              ? "Discovery run finished; inspect activity for coverage."
              : a === "snapshot"
                ? "Snapshot stored."
                : "Operation completed",
          );
        b.disabled = false;
      }),
  );
  document
    .querySelectorAll("[data-editdraft]")
    .forEach((b) => (b.onclick = () => draftModal(b.dataset.editdraft)));
  document.querySelectorAll("[data-approve]").forEach(
    (b) =>
      (b.onclick = () => {
        if (
          confirm(
            "Approve this exact message to this recipient under the recorded contact basis?",
          )
        )
          act(
            { action: "approve", id: b.dataset.approve },
            "Message approved — send it with “Process one eligible message”, or the next 15-minute worker run",
          );
      }),
  );
  document
    .querySelectorAll("[data-tasklead]")
    .forEach((b) => (b.onclick = () => taskModal(b.dataset.tasklead)));
  document.querySelectorAll("[data-donetask]").forEach(
    (b) =>
      (b.onclick = () => {
        const t = S.tasks.find((x) => x.id === b.dataset.donetask);
        act({ action: "task", ...t, status: "DONE" }, "Task completed");
      }),
  );
  document
    .querySelectorAll("[data-editcampaign]")
    .forEach((b) => (b.onclick = () => campaignModal(b.dataset.editcampaign)));
  document.querySelectorAll("[data-togglecampaign]").forEach((b) => {
    b.onclick = () => {
      const c = S.campaigns.find((x) => x.id === b.dataset.togglecampaign);
      act(
        {
          action: "campaign",
          id: c.id,
          value: { status: c.status === "ACTIVE" ? "PAUSED" : "ACTIVE" },
        },
        "Campaign updated",
      );
    };
  });
  document
    .querySelectorAll("[data-editcontent]")
    .forEach((b) => (b.onclick = () => contentModal(b.dataset.editcontent)));
  document
    .querySelectorAll("[data-updatecontent]")
    .forEach(
      (b) => (b.onclick = () => updateContentModal(b.dataset.updatecontent)),
    );
  document
    .querySelectorAll("tr[data-mail]")
    .forEach((tr) => {
      tr.onclick = () => {
        const m = mailData().all.find((x) => x.id === tr.dataset.mail);
        if (m) mailModal(m);
      };
    });
  document
    .querySelectorAll("[data-mailfilter]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          mailFilter = b.dataset.mailfilter;
          render();
        }),
    );
  document.querySelector("#saveAutopilot")?.addEventListener("click", async () => {
    const b = document.querySelector("#saveAutopilot");
    b.disabled = true;
    await act(
      {
        action: "settings",
        value: {
          autoContent: document.querySelector("#autoContentT").checked,
          contentCount: Number(document.querySelector("#contentCount").value),
          contentTopics: document.querySelector("#contentTopics").value,
          contentAi: document.querySelector("#contentAiT").checked,
        },
      },
      "Content autopilot saved",
    );
    b.disabled = false;
  });
  const readBackup = () =>
    new Promise((resolve, reject) => {
      const f = document.querySelector("#restoreFile")?.files?.[0];
      if (!f) return reject(Error("Choose a backup .json file first"));
      if (f.size > 5000000)
        return reject(Error("That file is larger than 5 MB — backups from this app are smaller"));
      const r = new FileReader();
      r.onerror = () => reject(Error("Could not read that file"));
      r.onload = () => {
        try {
          resolve(JSON.parse(r.result));
        } catch {
          reject(Error("That file is not valid JSON"));
        }
      };
      r.readAsText(f);
    });
  const showRestore = (title, res) => {
    const box = document.querySelector("#restoreResult");
    if (!box) return;
    const rows = Object.entries(res.summary || {})
      .map(([k, v]) =>
        v.skipped && !v.new && !v.updated
          ? `<tr><td>${esc(k)}</td><td colspan="3" class="muted">${esc(v.skipped)}</td></tr>`
          : `<tr><td>${esc(k)}</td><td>${v.new}</td><td>${v.updated}</td><td>${v.skipped}</td></tr>`,
      )
      .join("");
    box.innerHTML = `<div class="notice" style="margin-top:14px"><strong>${esc(title)}</strong> ${
      res.dryRun
        ? `${res.total} record(s) would be written. Nothing has changed yet.`
        : `${res.written} record(s) written. Reloading…`
    }</div><div class="table-wrap"><table><thead><tr><th>Record type</th><th>New</th><th>Updated</th><th>Skipped</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  document.querySelector("#restorePreview")?.addEventListener("click", async () => {
    const b = document.querySelector("#restorePreview");
    b.disabled = true;
    try {
      const backup = await readBackup();
      const r = await api({
        action: "restore",
        dryRun: true,
        mode: document.querySelector("#restoreMode").value,
        backup,
      });
      showRestore("Preview only — nothing written", r);
    } catch (e) {
      toast(e.message);
    }
    b.disabled = false;
  });
  document.querySelector("#restoreApply")?.addEventListener("click", async () => {
    const b = document.querySelector("#restoreApply");
    try {
      const backup = await readBackup();
      const mode = document.querySelector("#restoreMode").value;
      if (
        !confirm(
          mode === "update"
            ? "Replace existing records with the backup versions? Current edits to those records will be overwritten."
            : "Add the records from this backup that are missing here? Existing records are left untouched.",
        )
      )
        return;
      b.disabled = true;
      const r = await act(
        { action: "restore", mode, backup },
        "Backup restored",
      );
      if (r) showRestore("Restore complete", r);
      b.disabled = false;
    } catch (e) {
      toast(e.message);
    }
  });
  document.querySelector("#saveFollowup")?.addEventListener("click", async () => {
    const b = document.querySelector("#saveFollowup");
    b.disabled = true;
    await act(
      {
        action: "settings",
        value: {
          followUpOn: document.querySelector("#followUpOnT").checked,
          followUpDays: Number(document.querySelector("#followUpDays").value),
          followUpMax: Number(document.querySelector("#followUpMax").value),
          invoiceRemindersOn: document.querySelector("#invoiceRemindersT").checked,
          pauseWindows: document.querySelector("#pauseWindows").value,
        },
      },
      "Follow-up settings saved",
    );
    b.disabled = false;
  });
  document.querySelector("#writeConcept")?.addEventListener("click", async () => {
    const b = document.querySelector("#writeConcept");
    b.disabled = true;
    const r = await act(
      {
        action: "contentConcept",
        concept: document.querySelector("#conceptBox").value,
        channel: document.querySelector("#conceptChannel").value,
      },
      "Draft written from your concept — review it before posting.",
    );
    if (r && r.ok) document.querySelector("#conceptBox").value = "";
    b.disabled = false;
  });
  document.querySelectorAll("[data-approvecontent]").forEach((b) => {
    b.onclick = () =>
      act(
        {
          action: "content",
          id: b.dataset.approvecontent,
          value: { status: "APPROVED" },
        },
        "Post approved — paste and publish it on the channel.",
      );
  });
  document.querySelectorAll("[data-postcontent]").forEach((b) => {
    b.onclick = () =>
      act(
        {
          action: "content",
          id: b.dataset.postcontent,
          value: { status: "POSTED" },
        },
        "Marked posted — record reach/likes/comments after a day.",
      );
  });
  document.querySelectorAll("[data-skipcontent]").forEach((b) => {
    b.onclick = () =>
      act(
        {
          action: "content",
          id: b.dataset.skipcontent,
          value: { status: "SKIPPED" },
        },
        "Post skipped.",
      );
  });
  document.querySelectorAll("[data-savemetrics]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.savemetrics;
      act(
        {
          action: "content",
          id,
          value: {
            metrics: {
              reach: Number(
                document.querySelector(`[data-metric-reach="${id}"]`).value,
              ),
              likes: Number(
                document.querySelector(`[data-metric-likes="${id}"]`).value,
              ),
              comments: Number(
                document.querySelector(`[data-metric-comments="${id}"]`).value,
              ),
            },
          },
        },
        "Metrics recorded.",
      );
    };
  });
  document.querySelectorAll("[data-invreminder]").forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      const r = await act(
        { action: "invoiceReminder", id: b.dataset.invreminder },
        "Reminder draft created — review it in Review & send.",
      );
      if (r && r.created === 0)
        toast(
          "Nothing to draft: this invoice is paid, not overdue, already has an open reminder, or the customer is suppressed.",
        );
      b.disabled = false;
    };
  });
  document.querySelectorAll("[data-satisfaction]").forEach((b) => {
    b.onclick = () => {
      const [leadId, n] = b.dataset.satisfaction.split(":");
      act(
        { action: "lead", id: leadId, value: { satisfaction: Number(n) } },
        "Satisfaction recorded.",
      );
    };
  });
  document.querySelectorAll("[data-draftkind]").forEach((b) => {
    b.onclick = () => {
      const [leadId, kind] = b.dataset.draftkind.split(":");
      act(
        { action: "draft", id: leadId, kind },
        "Check-in draft created. Nothing sent.",
      ).then((r) => {
        if (r && !r.simulated) location.hash = "review";
      });
    };
  });
  document.querySelectorAll("[data-payinvoice]").forEach((b) => {
    b.onclick = () => {
      const inv = S.invoices.find((x) => x.id === b.dataset.payinvoice);
      if (
        confirm(
          `Record full payment of ${inv.amount.toLocaleString()} ${inv.currency} for this invoice?`,
        )
      )
        act(
          { action: "invoice", id: inv.id, value: { status: "PAID" } },
          "Payment recorded.",
        );
    };
  });
  document.querySelector("#search")?.addEventListener("input", (e) => {
    search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const f = document.querySelector("#search");
    f.focus();
    f.setSelectionRange(pos, pos);
  });
  document.querySelector("#filter")?.addEventListener("change", (e) => {
    filter = e.target.value;
    render();
  });
  document.querySelector("#settingsForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    act(
      {
        action: "settings",
        value: {
          focusCountries: f.getAll("focusCountries"),
          focusTypes: f.getAll("focusTypes"),
          niche: f.get("niche"),
          dailyTarget: Number(f.get("dailyTarget")),
          dailySendLimit: Number(f.get("dailySendLimit")),
          adaptiveExplore: Number(f.get("adaptiveExplore")),
        },
      },
      "Targeting preferences saved",
    );
  });
  document.querySelector("#import")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 250000)
      return toast("Keep each import below 250 KB / 100 rows.");
    try {
      const t = await file.text(),
        rows = file.name.endsWith(".json") ? JSON.parse(t) : parseCSV(t);
      const r = await act({ action: "import", rows }, "Import processed");
      if (r)
        toast(
          `${r.imported} unique primary-site records imported; consent left NONE.`,
        );
    } catch (err) {
      toast("Import failed: " + err.message);
    }
  });
}
window.addEventListener("hashchange", () => {
  view = location.hash.slice(1) || "overview";
  search = "";
  filter = "all";
  if (drawer.open) drawer.close();
  if (S) render();
});
load().catch((e) => {
  app.innerHTML =
    '<div class="login card"><h1>Workspace unavailable</h1><p>' +
    esc(e.message) +
    '</p><button onclick="location.reload()">Retry</button></div>';
});
