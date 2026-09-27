export const defaults = {
  paused: true,
  autoSendOptIn: true,
  autoApprove: true,
  emailVerify: true,
  mode: "broad",
  focusCountries: ["GB", "AU", "BD"],
  focusTypes: ["Established business"],
  dailyTarget: 50,
  dailySendLimit: 5,
  ownerName: "Fozayel Ibn Ayaz",
  portfolio: "https://fozayelibnayaz.github.io/portfolio/",
  skills: [
    "WordPress / PHP / ACF",
    "GA4 / GTM / reporting",
    "Dashboards / integrations",
    "Workflow automation",
  ],
  types: [
    "Established business",
    "New business",
    "Agency partner",
    "Freelancer partner",
    "Public work request",
  ],
  niche: "Website & WordPress",
  adaptiveExplore: 25,
  contentTopics: "",
  contentCount: 3,
  contentAi: false,
  autoReplyWatch: true,
  followUpOn: true,
  followUpDays: 4,
  followUpMax: 1,
  invoiceRemindersOn: true,
  pauseWindows: "",
  urgentWatch: true,
  urgentAi: false,
  watchAllInbox: false,
  urgentWords: "",
  language: "en",
  goalRevenue: 0,
  goalCustomers: 0,
  notifyAll: true,
  notifyNew: true,
  notifySends: true,
  notifyReplies: true,
  notifyUrgent: true,
  notifyContent: true,
  notifyBounces: true,
  notifyMoney: true,
  notifyTasks: true,
  notifyDigest: true,
  notifyErrors: true,
  notifyEveryProspect: false,
};
/* What the system may move by itself, and what only the owner may set. */
export const AUTO_STAGES = ["CONTACTED", "REPLIED", "CONVERSATION"];
export const MANUAL_STAGES = ["PROPOSAL", "NURTURE", "WON", "LOST"];
const allCountryCodes =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );
export const countryCodes = [
  ...new Set([
    "GB",
    "AU",
    "BD",
    "US",
    "CA",
    "AE",
    "NZ",
    "IE",
    "SG",
    "DE",
    "NL",
    "SE",
    "NO",
    "DK",
    "IN",
    "MY",
    "ZA",
    ...allCountryCodes,
  ]),
];
export function countryName(code) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code);
  } catch {
    return code;
  }
}
export const niches = [
  "Website & WordPress",
  "Analytics & reporting",
  "Workflow automation",
  "Design & content",
  "E-commerce",
  "Data operations",
];
export function metrics(leads) {
  const contacted = leads.filter((x) => x.firstContactAt),
    replied = contacted.filter((x) => x.replyAt);
  return {
    total: leads.length,
    held: leads.filter((x) => x.status === "HOLD").length,
    contactable: leads.filter(
      (x) => x.email && x.email !== "UNKNOWN" && x.status !== "HOLD",
    ).length,
    contacted: contacted.length,
    replied: replied.length,
    won: replied.filter((x) => x.stage === "WON").length,
    replyRate: contacted.length
      ? Math.round((100 * replied.length) / contacted.length)
      : null,
  };
}
export function cohorts(leads) {
  return niches.map((n) => {
    const m = metrics(leads.filter((l) => l.niche === n));
    return {
      niche: n,
      ...m,
      score: (m.replied + 1) / (m.contacted + 5),
      evidence: m.contacted < 10 ? "Insufficient sample" : "Observational only",
    };
  });
}
export function eligible(lead, draft, settings) {
  if (settings.paused) return "System paused";
  if (!lead || lead.suppressed) return "Suppressed or missing contact";
  if (lead.status === "HOLD") return "Source on hold";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email || ""))
    return "No valid email";
  /* An address the checker already proved wrong is never worth a send credit or a
   * bounce on the owner's domain. Role addresses are allowed — they are common. */
  if (["INVALID_SYNTAX", "NO_MAIL_SERVER", "DISPOSABLE"].includes(lead.emailStatus))
    return EMAIL_STATUS_LABEL[lead.emailStatus] + " — fix or replace the address first";
  if (!lead.contactEvidence) return "Contact permission evidence required";
  if (lead.status !== "APPROVED") return "Review and approve the source first";
  if (draft.approvedAt && draft.approvedEmail !== lead.email)
    return "Recipient changed: review and approve again";
  if (
    lead.consent === "OPT_IN" &&
    settings.autoSendOptIn &&
    !lead.replyAt &&
    !["WON", "LOST"].includes(lead.stage) &&
    (!lead.lastContactAt ||
      (lead.nextActionAt &&
        Date.parse(lead.nextActionAt) <= Date.now() &&
        Date.now() - Date.parse(lead.lastContactAt) > 86400000))
  )
    return null;
  if (!draft.approvedAt) return "Waiting for individual approval";
  if (!["OPT_IN", "BUSINESS_REVIEWED"].includes(lead.consent))
    return "Record a permitted contact basis";
  return null;
}
export function target(settings, cursor, leads) {
  const countries =
    settings.mode === "focused" ? settings.focusCountries : countryCodes;
  const types =
    settings.mode === "focused" ? settings.focusTypes : defaults.types;
  const country = countries[cursor % countries.length] || "GB";
  let type = types[cursor % types.length] || defaults.types[0];
  let niche = settings.niche;
  if (
    settings.mode === "adaptive" &&
    (cursor * 37) % 100 >= settings.adaptiveExplore
  ) {
    const ready = cohorts(leads).filter((x) => x.contacted >= 10);
    if (ready.length) {
      niche = ready.sort((a, b) => b.score - a.score)[0].niche;
      const typesReady = defaults.types
        .map((type) => ({
          type,
          ...metrics(leads.filter((l) => l.type === type)),
        }))
        .filter((x) => x.contacted >= 10);
      if (typesReady.length)
        type = typesReady.sort(
          (a, b) =>
            (b.replied + 1) / (b.contacted + 5) -
            (a.replied + 1) / (a.contacted + 5),
        )[0].type;
    } else niche = niches[cursor % niches.length];
  } else if (settings.mode !== "focused")
    niche = niches[cursor % niches.length];
  return { country, countryLabel: countryName(country), type, niche };
}
export function makeDraft(lead, settings, kind = "outreach") {
  return {
    leadId: lead.id,
    subject:
      kind === "welcome"
        ? "Welcome & next steps"
        : kind === "checkin"
          ? "Quick check-in — " + settings.ownerName
          : "Would website, reporting or workflow support be relevant?",
    body:
      kind === "welcome"
        ? `Hello,\n\nThanks for working with me. Before we start: tell me the best way to reach you quickly, anything I should know about deadlines, tools or access, and what a good first milestone looks like to you. I will check in after the first week and again at one month.\n\n${settings.ownerName}`
        : kind === "checkin"
          ? `Hello,\n\nRegular check-in from me — this is not a sales message. How is everything going with the work so far? If anything needs fixing, improving or explaining, tell me what matters most and I'll suggest the smallest useful step.\n\n${settings.ownerName}`
          : `Hello,\n\nI came across your business website. I’m ${settings.ownerName}, a developer and analyst based in Dhaka. I work on WordPress websites, tracking/reporting and integrations.\n\nWould help with ${(lead.niche || "digital services").toLowerCase()} be relevant to your current plans? I can share a relevant example. I have not audited your systems and am not assuming anything is broken.\n\nPortfolio: ${settings.portfolio}\n\nIf this is not relevant, please let me know and I won’t follow up.\n\n${settings.ownerName}`,
    status: "DRAFT",
    approvedAt: null,
    createdAt: new Date().toISOString(),
  };
}
export function validSettings(input, current) {
  const s = { ...current };
  for (const k of [
    "paused",
    "autoSendOptIn",
    "contentAi",
    "autoReplyWatch",
    "followUpOn",
    "invoiceRemindersOn",
    "urgentWatch",
    "urgentAi",
    "watchAllInbox",
    "autoApprove",
    "emailVerify",
    "notifyAll",
    "notifyNew",
    "notifySends",
    "notifyReplies",
    "notifyUrgent",
    "notifyContent",
    "notifyBounces",
    "notifyMoney",
    "notifyTasks",
    "notifyDigest",
    "notifyErrors",
    "notifyEveryProspect",
  ])
    if (k in input) {
      if (typeof input[k] !== "boolean") throw Error("Invalid toggle");
      s[k] = input[k];
    }
  if ("language" in input) {
    if (!["en", "bn"].includes(input.language)) throw Error("Invalid language");
    s.language = input.language;
  }
  if ("urgentWords" in input) {
    if (typeof input.urgentWords !== "string" || input.urgentWords.length > 500)
      throw Error("Urgent keywords must be a short list");
    s.urgentWords = input.urgentWords.trim();
  }
  for (const k of ["goalRevenue", "goalCustomers"])
    if (k in input) {
      if (
        typeof input[k] !== "number" ||
        !Number.isFinite(input[k]) ||
        input[k] < 0 ||
        input[k] > 100000000
      )
        throw Error("Invalid goal value");
      s[k] = input[k];
    }
  if ("pauseWindows" in input) {
    if (
      typeof input.pauseWindows !== "string" ||
      input.pauseWindows.length > 1200
    )
      throw Error("Pause windows must be a short list, one per line");
    parsePauseWindows(input.pauseWindows);
    s.pauseWindows = input.pauseWindows.trim();
  }
  if ("followUpDays" in input) {
    if (
      !Number.isInteger(input.followUpDays) ||
      input.followUpDays < 2 ||
      input.followUpDays > 14
    )
      throw Error("Follow-up delay must be 2-14 days");
    s.followUpDays = input.followUpDays;
  }
  if ("followUpMax" in input) {
    if (
      !Number.isInteger(input.followUpMax) ||
      input.followUpMax < 1 ||
      input.followUpMax > 2
    )
      throw Error("Follow-up maximum must be 1-2 extra touches");
    s.followUpMax = input.followUpMax;
  }
  if ("contentTopics" in input) {
    if (typeof input.contentTopics !== "string" || input.contentTopics.length > 1200)
      throw Error("Topics must be a short list, one per line");
    s.contentTopics = input.contentTopics.trim();
  }
  if ("contentCount" in input) {
    if (!Number.isInteger(input.contentCount) || input.contentCount < 1 || input.contentCount > 10)
      throw Error("Content count must be 1-10");
    s.contentCount = input.contentCount;
  }
  if (input.mode) {
    if (!["broad", "focused", "adaptive"].includes(input.mode))
      throw Error("Invalid mode");
    s.mode = input.mode;
  }
  for (const k of ["focusCountries", "focusTypes"])
    if (k in input) {
      const allowed = k === "focusCountries" ? countryCodes : defaults.types;
      if (
        !Array.isArray(input[k]) ||
        !input[k].length ||
        input[k].some((x) => !allowed.includes(x))
      )
        throw Error("Invalid focus selection");
      s[k] = [...new Set(input[k])];
    }
  for (const k of ["dailySendLimit", "dailyTarget", "adaptiveExplore"])
    if (k in input) {
      const max = k === "dailySendLimit" ? 20 : k === "dailyTarget" ? 50 : 100;
      if (!Number.isInteger(input[k]) || input[k] < 1 || input[k] > max)
        throw Error("Invalid limit");
      s[k] = input[k];
    }
  if (input.niche) {
    if (!niches.includes(input.niche)) throw Error("Invalid niche");
    s.niche = input.niche;
  }
  return s;
}

export const channels = ["LinkedIn post", "Facebook page", "X post"];
export const seasonHooks = [
  { label: "Seasonal demand surge", niche: "Website & WordPress", text: "When demand spikes, your website and enquiry path decide how much of that work actually reaches you. A clear service page and a fast contact route are the cheapest seasonal upgrade." },
  { label: "Peak e-commerce season", niche: "E-commerce", text: "Peak traffic rewards fast pages and clear tracking. If you cannot see which source or product converts, you are guessing with real money." },
  { label: "Reporting season", niche: "Analytics & reporting", text: "Reporting season is not only about accounts. Owners ask where new customers came from and what they cost. Clean tracking answers that without a consultant." },
  { label: "January administration squeeze", niche: "Workflow automation", text: "New-year energy dies fast when owner time is eaten by weekly administration. Automating the boring recurring tasks is how a small team stays calm." },
  { label: "Short seasonal window", niche: "Website & WordPress", text: "Seasonal businesses get one short window for enquiries. Your calendar, team page and contact form have to work during exactly that window." },
  { label: "Mid-year checkpoint", niche: "Analytics & reporting", text: "Mid-year is the honest checkpoint: which service pays, which lead source works, where time is lost. One shared dashboard makes that conversation short." }
];
export function parseTopics(settings) {
  return String(settings.contentTopics || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => {
      const m = line.match(/^([A-Za-z0-9_-]{1,12})\s*:\s*(.+)$/);
      return m
        ? { id: m[1], topic: m[2].trim().slice(0, 200) }
        : { id: null, topic: line.slice(0, 200) };
    });
}
export function contentFromConcept(concept, settings, channel = "LinkedIn post") {
  const day = Math.floor(Date.now() / 86400000);
  const skills = settings.skills?.length ? settings.skills : defaults.skills;
  const skill = skills[day % skills.length];
  const c = String(concept).trim();
  return (
    `On ${c}:\n\n` +
    "Most independent businesses can do the work. What leaks value is the invisible part — how enquiries arrive, how quickly they are answered, and whether the owner can actually see what is happening.\n\n" +
    "A small, measurable digital step usually fixes the leak: one clearer page, one faster answer path, one shared dashboard, or one automated follow-up so nothing falls through the cracks.\n\n" +
    `I work with independent businesses on ${skill.toLowerCase()}. If this is on your plate, send me a line and I will suggest the smallest useful next step — no invented numbers, no promises.` +
    (channel === "X post" ? "" : `\n\nPortfolio: ${settings.portfolio}`)
  );
}
export function generateContent(dateISO, settings, ctx) {
  const day = Math.floor(new Date(dateISO + "T12:00:00Z").getTime() / 86400000);
  const skills = settings.skills?.length ? settings.skills : defaults.skills;
  const skill = skills[day % skills.length];
  const hook = seasonHooks[day % seasonHooks.length];
  const topics = parseTopics(settings);
  if (topics.length) {
    const count = Math.max(1, Math.min(10, Number(settings.contentCount) || 3));
    const channels = ["LinkedIn post", "Facebook page", "X post"];
    const items = [];
    for (let i = 0; i < count; i++) {
      const t = topics[(day * 3 + i) % topics.length];
      items.push({
        id: `content-${dateISO}-${i + 1}`,
        date: dateISO,
        channel: channels[(day + i) % channels.length],
        title: (t.id ? t.id + " · " : "") + t.topic.slice(0, 60),
        body: contentFromConcept(t.topic, settings, channels[(day + i) % channels.length]),
        status: "DRAFT",
        niche: settings.niche,
        topic: t.topic,
        source: "autopilot",
        campaignId: (ctx.campaigns || []).find((c) => c.status === "ACTIVE")?.id || null,
        metrics: { reach: 0, likes: 0, comments: 0 },
        createdAt: dateISO + "T00:00:00.000Z",
      });
    }
    const win = (ctx.leads || []).find(
      (l) => l.stage === "WON" && l.replyAt && (l.notes || "").length >= 20,
    );
    if (win)
      items.push({
        id: `content-${dateISO}-case`,
        date: dateISO,
        channel: "Facebook page",
        title: "Client work (owner-recorded note)",
        body: `Recent work for a ${win.niche.toLowerCase()} client:\n\n"${win.notes.slice(0, 300)}"\n\n— owner-recorded project note; results are the client’s own words, not a guarantee.`,
        status: "DRAFT",
        niche: win.niche,
        source: "autopilot",
        campaignId: (ctx.campaigns || []).find((c) => c.status === "ACTIVE")?.id || null,
        metrics: { reach: 0, likes: 0, comments: 0 },
        createdAt: dateISO + "T00:00:00.000Z",
      });
    return items;
  }
  const campaign = ctx.campaigns?.find((c) => c.status === "ACTIVE") || null;
  const win = (ctx.leads || []).find(
    (l) => l.stage === "WON" && l.replyAt && (l.notes || "").length >= 20,
  );
  const items = [
    {
      id: `content-${dateISO}-1`,
      date: dateISO,
      channel: "LinkedIn post",
      title: hook.label,
      body: `Most small businesses do not have a website problem. They have a visibility problem.

${hook.text}

I work with independent businesses on ${skill.toLowerCase()}.
Portfolio: ${settings.portfolio}`,
      status: "DRAFT",
      niche: hook.niche,
      campaignId: campaign?.id || null,
      metrics: { reach: 0, likes: 0, comments: 0 },
      createdAt: dateISO + "T00:00:00.000Z",
    },
    {
      id: `content-${dateISO}-2`,
      date: dateISO,
      channel: "Facebook page",
      title: hook.label,
      body: `${hook.text}

We help ${settings.focusCountries.length ? "selected markets" : "independent businesses"} with ${skill.toLowerCase()}. Message us to talk it through.`,
      status: "DRAFT",
      niche: hook.niche,
      campaignId: campaign?.id || null,
      metrics: { reach: 0, likes: 0, comments: 0 },
      createdAt: dateISO + "T00:00:00.000Z",
    },
  ];
  if (day % 7 === 3) {
    items.push({
      id: `content-${dateISO}-3`,
      date: dateISO,
      channel: "LinkedIn post",
      title: "Owner tip of the week",
      body: `Tip for business owners: you cannot improve what you do not measure. One dashboard that shows enquiries, replies and follow-ups is worth more than five disconnected reports.

${settings.ownerName} · ${skill}`,
      status: "DRAFT",
      niche: settings.niche,
      campaignId: campaign?.id || null,
      metrics: { reach: 0, likes: 0, comments: 0 },
      createdAt: dateISO + "T00:00:00.000Z",
    });
  }
  if (win) {
    items.push({
      id: `content-${dateISO}-case`,
      date: dateISO,
      channel: "Facebook page",
      title: "Client work (owner-recorded note)",
      body: `Recent work for a ${win.niche.toLowerCase()} client:

"${win.notes.slice(0, 300)}"

— owner-recorded project note; results are the client’s own words, not a guarantee.`,
      status: "DRAFT",
      niche: win.niche,
      campaignId: campaign?.id || null,
      metrics: { reach: 0, likes: 0, comments: 0 },
      createdAt: dateISO + "T00:00:00.000Z",
    });
  }
  return items;
}
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
export function parsePauseWindows(text) {
  const out = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d{4}-\d{2}-\d{2})(?:\s*\.\.\s*(\d{4}-\d{2}-\d{2}))?$/);
    if (!m || !isoDate.test(m[1]) || (m[2] && !isoDate.test(m[2])))
      throw Error("Pause windows must look like 2026-12-20..2027-01-03");
    const from = m[1],
      to = m[2] || m[1];
    if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)))
      throw Error("Pause window has an invalid date");
    if (to < from) throw Error("Pause window ends before it starts");
    out.push({ from, to });
  }
  if (out.length > 12) throw Error("Keep pause windows to 12 or fewer");
  return out;
}
export function inPauseWindow(settings, dateISO) {
  let windows;
  try {
    windows = parsePauseWindows(settings.pauseWindows);
  } catch {
    return null;
  }
  const d = String(dateISO).slice(0, 10);
  return windows.find((w) => d >= w.from && d <= w.to) || null;
}
export function makeFollowup(lead, settings, days, originalSubject, touch = 1) {
  const skills = settings.skills?.length ? settings.skills : defaults.skills;
  const skill = skills[(days + (lead.company || "").length) % skills.length];
  const subject = /^re:/i.test(String(originalSubject || ""))
    ? originalSubject
    : "Re: " + (originalSubject || "your website");
  if (touch >= 2)
    return {
      leadId: lead.id,
      kind: "followup",
      subject: String(subject).slice(0, 160),
      body: `Hello,

This is the last message from me about ${(lead.niche || "digital services").toLowerCase()} — I do not send more than two, and you have not asked for anything.

I will close the file after this unless you reply. If a small piece of work would help later (${skill.toLowerCase()}), the easiest thing is to keep this thread and write one line whenever the timing is right.

No follow-up will be sent automatically after this message either way.

Portfolio: ${settings.portfolio}

${settings.ownerName}`,
      status: "DRAFT",
      approvedAt: null,
      createdAt: new Date().toISOString(),
    };
  return {
    leadId: lead.id,
    kind: "followup",
    subject: String(subject).slice(0, 160),
    body: `Hello,

I wrote ${days} days ago about ${(lead.niche || "digital services").toLowerCase()} support and have not heard back — that is completely fine, and I will not keep chasing.

The only reason I am writing once more: the usual leak is small and fixable — one clearer page, one faster enquiry path, one dashboard showing what actually happens (${skill.toLowerCase()}).

If it is not relevant, reply with "no" and I will close the file for good. If the timing is simply wrong, ignore this message and nothing further will be sent automatically.

Portfolio: ${settings.portfolio}

${settings.ownerName}`,
    status: "DRAFT",
    approvedAt: null,
    createdAt: new Date().toISOString(),
  };
}
export const checkinPlan = [
  { offset: 1, label: "Welcome & onboarding confirmation" },
  { offset: 7, label: "First-week check-in" },
  { offset: 30, label: "Satisfaction, renewal & referral conversation" },
];
export function marketingIdeas({ leads = [], content = [], invoices = [], tasks = [], day }) {
  const out = [];
  for (const c of cohorts(leads)) {
    if (c.contacted >= 10 && c.replied > 0)
      out.push({ id: "niche-up", niche: c.niche, text: `More content about ${c.niche}: ${c.replied} of ${c.contacted} contacted replies (observational, not causal).` });
    if (c.contacted >= 10 && c.replied === 0)
      out.push({ id: "niche-pause", niche: c.niche, text: `Pause ${c.niche} outreach for now: 0 replies from ${c.contacted}. Review the message and the fit hypothesis.` });
  }
  const recentWon = leads.filter((l) => l.stage === "WON" && l.replyAt && Date.now() - Date.parse(l.replyAt) < 30 * 86400000);
  if (leads.some((l) => l.stage === "WON") && recentWon.length === 0)
    out.push({ id: "case-study", text: "No recorded win in 30 days. Publish one case study or client testimonial (owner-recorded, no invented numbers)." });
  const overdue = tasks.filter((t) => t.status === "OPEN" && t.due < day);
  if (overdue.length >= 3)
    out.push({ id: "clear-backlog", text: `Clear ${overdue.length} overdue follow-ups before adding new outreach.` });
  if (!content.some((c) => c.status === "POSTED" && new Date(c.date + "T23:59:59Z").getTime() > Date.now() - 14 * 86400000))
    out.push({ id: "publish", text: "Nothing posted in the last 14 days. Approve and post at least one piece this week." });
  const withInvoice = leads.filter((l) => l.stage === "WON");
  const missing = withInvoice.length - invoices.length;
  if (missing > 0)
    out.push({ id: "invoices", text: `Record invoices for ${missing} recorded win(s) so finance is visible.` });
  const contacted = leads.filter((l) => l.firstContactAt);
  const replied = contacted.filter((l) => l.replyAt);
  if (contacted.length >= 10 && replied.length / contacted.length >= 0.2)
    out.push({ id: "follow-up", text: "Reply rate is strong. Consider one reviewed follow-up touch per open conversation." });
  return out.slice(0, 6);
}
export const businessMap = [
  { stage: "Offers & portfolio", people: "Define services, pricing, proof", status: "BUILT", note: "Offers editable in Settings; portfolio link sits in every draft." },
  { stage: "Marketing content", people: "Daily posts, pages, tips", status: "BUILT", note: "Auto-drafted every day; you approve, edit, post and record metrics." },
  { stage: "Campaigns", people: "Coordinate outreach + content", status: "BUILT", note: "Organic campaigns tied to niches; no paid ads (not free)." },
  { stage: "Social posting", people: "Publish to Facebook/LinkedIn/X", status: "PARTIAL", note: "LinkedIn: no free official auto-post API, so approved copy-paste. Facebook/X connectors are a later optional owner-setup step." },
  { stage: "Lead discovery", people: "Find candidate businesses", status: "BUILT", note: "124 countries / 683 cities, broad/focused/adaptive, free quotas visible." },
  { stage: "Outreach", people: "Contact with permission rules", status: "REVIEW GATED", note: "Auto only for recorded opt-in; everything else needs your approval." },
  { stage: "Sales & proposals", people: "Quotes, proposals, negotiation", status: "BUILT", note: "Stage history, win/loss reasons, proposal drafts, quotes." },
  { stage: "Invoicing & payments", people: "Bill and record money", status: "BUILT", note: "Invoices recorded in app; payment happens externally (bKash/bank/card)." },
  { stage: "Project delivery", people: "Execute and track work", status: "BUILT", note: "Work board with milestones; you record completion." },
  { stage: "Onboarding", people: "Start a customer well", status: "BUILT", note: "Automatic task + welcome draft when a lead becomes WON." },
  { stage: "Customer check-ins & renewals", people: "Keep customers happy", status: "BUILT", note: "Day 1/7/30 schedule, weekly digest, satisfaction score, referral talk at day 30." },
  { stage: "Churn & behaviour analytics", people: "See who leaves and why", status: "NEEDS DATA", note: "Requires first-party usage/payment data. No invented churn score." },
  { stage: "Referrals", people: "Ask at the right moment", status: "REVIEW GATED", note: "Day-30 check-in includes the referral conversation template." },
  { stage: "Finance reporting", people: "What came in, what is owed", status: "BUILT", note: "Paid/outstanding/open pipeline from recorded invoices and wins." },
  { stage: "Compliance & opt-outs", people: "Stay lawful per country", status: "GUARDED", note: "Suppression, unsubscribe links, per-message evidence. Final legal judgment stays yours." },
  { stage: "Paid advertising", people: "Meta/Google/LinkedIn ads", status: "NOT FREE", note: "Outside this system; no paid fallback anywhere in the app." },
];
export function makeInvoiceReminder(lead, invoice, settings) {
  const currency = invoice.currency || "USD";
  const amount = Number(invoice.amount || 0).toLocaleString("en-GB");
  return {
    leadId: lead.id,
    invoiceId: invoice.id,
    kind: "invoice-reminder",
    subject: `Invoice reminder — ${amount} ${currency} (due ${invoice.dueAt})`,
    body: `Hello,

A quiet note about invoice ${invoice.id} for ${amount} ${currency}, which was due on ${invoice.dueAt}. If it is already paid, please ignore this — bank and transfer timing can cross in the post.

If a different arrangement would be easier (a different date, a split payment, or a question about the amount), reply and we will sort it out.

Thank you for the work we did together.

${settings.ownerName}`,
    status: "DRAFT",
    approvedAt: null,
    createdAt: new Date().toISOString(),
  };
}

export const URGENT_WORDS = [
  "call now", "call me", "call us", "please call", "phone me", "give me a call",
  "email now", "reply now", "urgent", "asap", "immediately", "time sensitive",
  "time-sensitive", "emergency", "today", "right away", "deadline",
];
export const HIGH_WORDS = [
  "meeting", "schedule", "available", "tomorrow", "this week", "ready to pay",
  "contract", "sign", "proposal", "invoice", "quote", "budget approved",
  "let's talk", "lets talk", "interested", "when can you start",
];
export function urgentScore(text, extraWords = "") {
  const t = " " + String(text || "").toLowerCase().replace(/\s+/g, " ") + " ";
  const custom = String(extraWords || "")
    .split(/[,\n]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const urgentHits = [
    ...URGENT_WORDS.filter((w) => t.includes(w)),
    ...custom.filter((w) => t.includes(w)),
  ];
  const highHits = HIGH_WORDS.filter((w) => t.includes(w));
  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(t);
  if (urgentHits.length || hasPhone)
    return {
      tier: "URGENT",
      hits: [...urgentHits, ...(hasPhone ? ["phone number in message"] : [])],
    };
  if (highHits.length >= 2) return { tier: "HIGH", hits: highHits };
  if (highHits.length === 1) return { tier: "HIGH", hits: highHits };
  return { tier: null, hits: [] };
}
export function fitScore(lead) {
  const reasons = [];
  let score = 30;
  const platform = String(lead.platform || "").toLowerCase();
  const weak = { wix: 18, squarespace: 18, godaddy: 16, "squarespace ": 18, weebly: 16, jimdo: 16 };
  if (weak[platform]) { score += weak[platform]; reasons.push(`${lead.platform} site (limited control) +${weak[platform]}`); }
  else if (platform === "wordpress") { score += 12; reasons.push("WordPress site (direct fit) +12"); }
  else if (platform === "shopify") { score += 8; reasons.push("Shopify store (e-commerce fit) +8"); }
  else if (platform === "custom" || platform === "unknown") { score += 4; reasons.push("Platform unclear — worth a look +4"); }
  if (lead.analytics === false) { score += 15; reasons.push("No GA4/GTM detected +15"); }
  else if (lead.analytics === true) { score += 4; reasons.push("Analytics already present +4"); }
  if (lead.hiringSignal) { score += 20; reasons.push("Site suggests hiring +20"); }
  const socials = lead.socials || {};
  const socialCount = Object.values(socials).filter(Boolean).length;
  if (socialCount === 0) { score += 8; reasons.push("No social profiles found +8"); }
  else { score += Math.min(8, socialCount * 2); reasons.push(`${socialCount} social profile(s) found +${Math.min(8, socialCount * 2)}`); }
  if (lead.website && !/^https:\/\//i.test(lead.website)) { score += 6; reasons.push("Site not on HTTPS +6"); }
  if (lead.status === "HOLD") { score -= 40; reasons.push("Source on hold −40"); }
  if (lead.suppressed) { score -= 60; reasons.push("Suppressed −60"); }
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons: reasons.slice(0, 6) };
}
const BN_OUTREACH = `আসসালামু আলাইকুম,

আমি ${"{owner}"}, ঢাকা থেকে একজন ডেভেলপার ও অ্যানালিস্ট। আপনার ব্যবসার ওয়েবসাইট দেখে যোগাযোগ করছি। আমি ওয়ার্ডপ্রেস ওয়েবসাইট, ট্র্যাকিং/রিপোর্টিং এবং ইন্টিগ্রেশন নিয়ে কাজ করি।

আপনার বর্তমান পরিকল্পনায় {niche} সহায়তা কাজে লাগতে পারে কি? চাইলে একটি প্রাসঙ্গিক উদাহরণ পাঠাতে পারি। আমি আপনার সিস্টেম অডিট করিনি এবং কোনো সমস্যা ধরে নিচ্ছি না।

পোর্টফোলিও: {portfolio}

যদি প্রাসঙ্গিক না হয়, জানালে আর ফলো-আপ করব না।

ধন্যবাদ,
{owner}`;
const BN_CHECKIN = `আসসালামু আলাইকুম,

নিয়মিত চেক-ইন — এটি কোনো বিক্রয় বার্তা নয়। কাজের অগ্রগতি কেমন চলছে? কিছু ঠিক করা, উন্নত করা বা বুঝিয়ে দেওয়ার প্রয়োজন হলে জানান — আমি সবচেয়ে ছোট কার্যকর পদক্ষেপটি সাজেস্ট করব।

ধন্যবাদ,
{owner}`;
const BN_WELCOME = `আসসালামু আলাইকুম,

সাথে কাজ করার জন্য ধন্যবাদ। শুরু করার আগে জানান: দ্রুত যোগাযোগের সেরা উপায়, ডেডলাইন/টুল/অ্যাক্সেস নিয়ে কিছু জানার থাকলে, এবং প্রথম মাইলস্টোন কেমন হলে ভালো হয়। প্রথম সপ্তাহে এবং এক মাস পরে আবার চেক-ইন করব।

ধন্যবাদ,
{owner}`;
function fillBn(t, settings, lead) {
  return t
    .replaceAll("{owner}", settings.ownerName)
    .replaceAll("{portfolio}", settings.portfolio)
    .replaceAll("{niche}", (lead?.niche || "ডিজিটাল সেবা").toLowerCase());
}
export const BN_TEMPLATES = { outreach: BN_OUTREACH, checkin: BN_CHECKIN, welcome: BN_WELCOME };
export function outreachSubject(lead = {}) {
  const c = lead.company || "your business";
  const n = (lead.niche || "website, tracking or workflow").toLowerCase();
  return `${c}: ${sentenceCase(n)} help?`;
}
export function makeLocalizedDraft(lead, settings, kind, language) {
  if (language !== "bn") {
    if (kind !== "outreach" && kind !== "followup") return makeDraft(lead, settings, kind);
    const obs = observation(lead);
    return {
      leadId: lead.id,
      subject: kind === "followup" ? `Following up — ${lead.company || "your business"}` : outreachSubject(lead),
      body:
        (kind === "followup"
          ? `Hello,\n\nOne short follow-up on my note about ${(lead.niche || "website and reporting work").toLowerCase()} — no pressure at all.\n\n` +
            (obs.length ? researchLine(lead) + "\n\n" : "") +
            `If it is useful, I can send one specific example and a two-line plan for ${lead.company || "your business"}. If not, a one-word no is completely fine and I will close the file.`
          : professionalOutreach(lead, settings)) +
        (kind === "followup" ? `\n\nPortfolio: ${settings.portfolio || ""}\n\nBest,\n${settings.ownerName}` : ""),
      observation: obs.join(", and "),
      grounded: obs.length > 0,
      language: "en",
      status: "DRAFT",
      approvedAt: null,
      createdAt: new Date().toISOString(),
    };
  }
  const d = makeDraft(lead, settings, kind);
  return {
    ...d,
    language: "bn",
    subject:
      kind === "welcome"
        ? "স্বাগতম ও পরবর্তী ধাপ"
        : kind === "checkin"
          ? "দ্রুত খোঁজ নেওয়া — " + settings.ownerName
          : "ওয়েবসাইট, রিপোর্টিং বা ওয়ার্কফ্লো সহায়তা প্রাসঙ্গিক হবে কি?",
    body: fillBn(BN_TEMPLATES[kind] || BN_TEMPLATES.outreach, settings, lead),
  };
}
export const PLAYBOOK = [
  { id: "p1", en: "Message 10 businesses in your own city with a specific, useful observation about their site.", bn: "আপনার শহরের ১০টি ব্যবসাকে তাদের সাইট নিয়ে একটি নির্দিষ্ট, সহায়ক পর্যবেক্ষণসহ বার্তা পাঠান।" },
  { id: "p2", en: "Offer one small paid pilot (a single page or a tracking fix) instead of a big project.", bn: "বড় প্রজেক্টের বদলে একটি ছোট পেইড পাইলট (একটি পেজ বা ট্র্যাকিং ঠিক করা) অফার করুন।" },
  { id: "p3", en: "Publish one before/after or 'here is how I work' post every week.", bn: "প্রতি সপ্তাহে একটি before/after বা 'আমি যেভাবে কাজ করি' পোস্ট প্রকাশ করুন।" },
  { id: "p4", en: "Ask every finished customer for one sentence of feedback you may quote.", bn: "প্রতিটি সম্পন্ন কাস্টমারের কাছে quotable একটি বাক্য ফিডব্যাক চান।" },
  { id: "p5", en: "Partner with one agency that needs overflow help, not with other freelancers.", bn: "অন্য ফ্রিল্যান্সারের বদলে যাদের বাড়তি কাজের সহায়তা দরকার এমন একটি এজেন্সির সাথে পার্টনারশিপ করুন।" },
  { id: "p6", en: "Answer one public question a week where your expertise is genuinely useful.", bn: "প্রতি সপ্তাহে একটি পাবলিক প্রশ্নের উত্তর দিন যেখানে আপনার দক্ষতা সত্যিই কাজে লাগে।" },
  { id: "p7", en: "Put your price and what it includes on your portfolio page — vague pricing wastes calls.", bn: "আপনার পোর্টফোলিও পেজে দাম ও কী কী অন্তর্ভুক্ত তা লিখুন — অস্পষ্ট দামে কল নষ্ট হয়।" },
  { id: "p8", en: "Follow up once, politely, on every unanswered enquiry — most replies come from the second message.", bn: "প্রতিটি উত্তরহীন অনুসন্ধানে ভদ্রভাবে একবার ফলো-আপ করুন — বেশিরভাগ উত্তর দ্বিতীয় বার্তায় আসে।" },
  { id: "p9", en: "Keep a one-page list of your best work with the problem, what you did, and the outcome.", bn: "সেরা কাজের একটি পেজ রাখুন: সমস্যা, আপনি কী করেছেন এবং ফলাফল।" },
  { id: "p10", en: "Send your invoice the same day you finish — money follows clarity.", bn: "কাজ শেষ করার দিনেই ইনভয়েস পাঠান — স্পষ্টতাই টাকা আনে।" },
];
export const CONTENT_STARTERS = [
  { id: "c1", en: "A mistake you see in most small business websites (and the 20-minute fix).", bn: "ছোট ব্যবসার বেশিরভাগ ওয়েবসাইটে দেখা একটি ভুল (এবং ২০ মিনিটের সমাধান)।" },
  { id: "c2", en: "What one dashboard should show an owner every Monday morning.", bn: "সোমবার সকালে একটি ড্যাশবোর্ডে মালিকের কী দেখা উচিত।" },
  { id: "c3", en: "Why 'we will fix it later' costs more than fixing it now — with numbers from public sources.", bn: "'পরে ঠিক করব' কেন এখন ঠিক করার চেয়ে বেশি খরচ করায় — পাবলিক সূত্র থেকে সংখ্যাসহ।" },
  { id: "c4", en: "Three questions to ask before paying for any website redesign.", bn: "যেকোনো ওয়েবসাইট রিডিজাইনের টাকা দেওয়ার আগে তিনটি প্রশ্ন।" },
  { id: "c5", en: "How I onboard a new client in the first week (the exact checklist).", bn: "প্রথম সপ্তাহে আমি কীভাবে নতুন ক্লায়েন্ট অনবোর্ড করি (সঠিক চেকলিস্ট)।" },
];
export function launchPlan(answers) {
  const { offer = "digital services", audience = "small businesses", price = "", city = "", hours = "10" } = answers || {};
  const day = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  const items = [
    ["Write your one-sentence offer", `Finish this sentence: I help ${audience} with ${offer} so they get a measurable result.`, 0],
    ["Set your price and what it includes", price ? `Start at ${price}` : "Pick one number for a pilot engagement and one for a full project.", 1],
    ["Make one proof page", `One page: the problem, what you did, the outcome${city ? ` — from ${city}` : ""}. No invented numbers.`, 2],
    ["Prepare your outreach message", "Short, specific, one question. The app drafts it for you from your skills.", 3],
    ["Build your list of 30 prospects", `Real ${audience} with public contact details. Discovery can start this today.`, 3],
    ["Contact the first 10 (review each one)", "Small batches beat mass sends. Approve every message.", 5],
    ["Publish your first two posts", "Use the content starters — one useful tip, one piece of your own work.", 6],
    ["Follow up once on silence", "Day 4, one polite nudge, then stop. The app does this for you.", 10],
    ["Send your first proposal", "Quote the smallest useful piece of work, not the biggest.", 14],
    ["Invoice the same day you finish", "Record it in Finance; reminders are automatic if it goes overdue.", 20],
    ["Ask for one quotable sentence", "Turn finished work into proof you can reuse.", 24],
    ["Review the numbers at day 30", `Target for the month: ${settings_hint(hours)}`, 30],
  ];
  return items.map(([title, note, offset], i) => ({
    id: "plan-" + (i + 1),
    title,
    note,
    due: day(offset),
    offset,
    type: i < 5 ? "REVIEW" : i < 9 ? "FOLLOW_UP" : i < 11 ? "SUPPORT" : "MARKETING",
    status: "OPEN",
  }));
}
function settings_hint(hours) {
  const h = Number(hours) || 10;
  return h >= 30 ? "aim high — you have full-time hours; expect 2–4 real conversations"
    : h >= 15 ? "with part-time hours: 1–3 real conversations is a good month"
    : "with limited hours: one real conversation is a win; keep the list small";
}
export function goalPace({ settings, leads, invoices, dayISO }) {
  const month = String(dayISO).slice(0, 7);
  const dayOfMonth = Number(String(dayISO).slice(8, 10));
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const paidThisMonth = (invoices || [])
    .filter((i) => i.status === "PAID" && String(i.paidAt || i.dueAt || "").slice(0, 7) === month)
    .reduce((n, i) => n + Number(i.amount || 0), 0);
  const wonThisMonth = (leads || []).filter(
    (l) => l.stage === "WON" && String(l.replyAt || "").slice(0, 7) === month,
  ).length;
  const expected = (settings.goalRevenue || 0) * (dayOfMonth / daysInMonth);
  const pace =
    !settings.goalRevenue && !settings.goalCustomers
      ? null
      : {
          revenue: settings.goalRevenue
            ? { target: settings.goalRevenue, soFar: paidThisMonth, expected: Math.round(expected) }
            : null,
          customers: settings.goalCustomers
            ? { target: settings.goalCustomers, soFar: wonThisMonth, expected: Number((settings.goalCustomers * (dayOfMonth / daysInMonth)).toFixed(1)) }
            : null,
          dayOfMonth,
          daysInMonth,
        };
  return { paidThisMonth, wonThisMonth, pace };
}
export function healthCheck({ leads, invoices, tasks, content, day: d }) {
  const out = [];
  const unanswered = leads.filter((l) => ["REPLIED", "CONVERSATION"].includes(l.stage)).length;
  if (unanswered) out.push({ level: "high", text: `${unanswered} conversation(s) waiting for your answer — replies decay fast.` });
  const overdue = invoices.filter((i) => i.status !== "PAID" && i.dueAt && i.dueAt < d);
  if (overdue.length) out.push({ level: "high", text: `${overdue.length} overdue invoice(s). Draft a reminder from Finance.` });
  const staleTasks = tasks.filter((t) => t.status === "OPEN" && t.due && t.due < d).length;
  if (staleTasks) out.push({ level: "medium", text: `${staleTasks} task(s) past due — pick the one that touches money first.` });
  const posted = content.filter((c) => c.status === "POSTED" && Date.parse(c.date + "T23:59:59Z") > Date.now() - 14 * 86400000).length;
  if (!posted) out.push({ level: "medium", text: "Nothing posted in 14 days. Approve one content draft this week." });
  const quiet = leads.filter((l) => l.firstContactAt && !l.replyAt && Date.now() - Date.parse(l.lastContactAt || l.firstContactAt) > 7 * 86400000);
  if (quiet.length) out.push({ level: "medium", text: `${quiet.length} contact(s) silent for over a week — the follow-up autopilot drafts one nudge each.` });
  const draftsWaiting = leads.filter((l) => l.status === "UNREVIEWED").length;
  if (draftsWaiting > 20) out.push({ level: "low", text: `${draftsWaiting} prospects still unreviewed — review in small batches to keep quality.` });
  if (!out.length) out.push({ level: "ok", text: "Everything that needs a human is handled. Keep going." });
  return out;
}
export const JOURNEY = [
  { id: "FOUND", label: "Discovered", test: () => true },
  { id: "REVIEWED", label: "Reviewed by you", test: (l) => ["APPROVED", "HOLD"].includes(l.status) },
  { id: "CONTACTED", label: "Contacted", test: (l) => !!l.firstContactAt },
  { id: "REPLIED", label: "Replied", test: (l) => !!l.replyAt },
  { id: "PROPOSAL", label: "Proposal / quote", test: (l) => ["PROPOSAL", "WON"].includes(l.stage) || !!l.quote },
  { id: "WON", label: "Customer", test: (l) => l.stage === "WON" },
  { id: "INVOICED", label: "Invoiced", test: (l, invs) => (invs || []).some((i) => i.leadId === l.id) },
  { id: "PAID", label: "Paid", test: (l, invs) => (invs || []).some((i) => i.leadId === l.id && i.status === "PAID") },
];
export function journeyStep(lead, invoices = []) {
  let step = 0;
  JOURNEY.forEach((s, i) => {
    if (s.test(lead, invoices)) step = i;
  });
  return { index: step, id: JOURNEY[step].id, label: JOURNEY[step].label };
}
export function journey(leads, invoices = []) {
  const steps = JOURNEY.map((s) => ({
    id: s.id,
    label: s.label,
    count: leads.filter((l) => s.test(l, invoices)).length,
  }));
  const perLead = leads
    .map((l) => {
      const j = journeyStep(l, invoices);
      return {
        id: l.id,
        company: l.company,
        stage: l.stage,
        step: j.index,
        stepLabel: j.label,
        paid: (invoices || []).some((i) => i.leadId === l.id && i.status === "PAID"),
      };
    })
    .filter((x) => x.step > 0 || x.stage === "WON")
    .sort((a, b) => b.step - a.step)
    .slice(0, 12);
  const converted = steps.find((s) => s.id === "WON").count;
  return {
    steps,
    perLead,
    found: leads.length,
    converted,
    paid: steps.find((s) => s.id === "PAID").count,
  };
}

/* ---------------------------------------------------------------- replies ---- *
 * Replies are classified so the owner can act on them; classification only ever
 * ALERTS. It never suppresses, never unsubscribes and never auto-replies — a
 * keyword like "call" also appears in "please don't call".
 */
export const NEGATIVE_PATTERNS = [
  { re: /\bnot interested\b/i, label: "not interested" },
  { re: /\bno (thanks|thank you)\b/i, label: "no thanks" },
  { re: /\bdo not (contact|call|email)\b/i, label: "asked not to be contacted" },
  { re: /\bdon't (contact|call|email)\b/i, label: "asked not to be contacted" },
  { re: /\bplease (stop|remove|unsubscribe)\b/i, label: "asked to stop" },
  { re: /\bunsubscribe\b/i, label: "unsubscribe wording" },
  { re: /\bremove me\b/i, label: "asked to be removed" },
  { re: /\bwe are all set\b/i, label: "no need right now" },
  { re: /\bno longer (need|interested)\b/i, label: "no longer interested" },
  { re: /\btake (me|us) off\b/i, label: "asked to be removed" },
];
export const OFFICE_WORDS =
  /\b(out of (the )?office|annual leave|on leave|away from my desk|away until|i am away|i'm away|away this week|on holiday|maternity leave|paternity leave|limited access to email|returning on|back on [a-z]+day|back in the office|automatic reply|auto-?reply)\b/i;
export const INTEREST_HINTS = [
  "interested",
  "sounds good",
  "tell me more",
  "send me",
  "share more",
  "let's talk",
  "lets talk",
  "happy to chat",
  "book a call",
  "schedule",
  "price",
  "quote",
  "budget",
  "proposal",
  "when can you start",
];
export function classifyReply(text, meta = {}) {
  const t = " " + String(text || "").replace(/\s+/g, " ").toLowerCase() + " ";
  const subject = String(meta.subject || "").toLowerCase();
  const reasons = [];
  if (
    meta.autoSubmitted && String(meta.autoSubmitted).toLowerCase() !== "no"
  ) {
    return { class: "OFFICE", tier: null, hits: ["Auto-Submitted header (RFC 3834)"], why: "Automatic reply header — nothing to answer." };
  }
  if (OFFICE_WORDS.test(t) || OFFICE_WORDS.test(subject))
    return { class: "OFFICE", tier: null, hits: ["out-of-office wording"], why: "Looks like an automatic out-of-office reply." };
  const negative = NEGATIVE_PATTERNS.filter((x) => x.re.test(t));
  if (negative.length)
    return {
      class: "NEGATIVE",
      tier: "ATTENTION",
      hits: [negative[0].label, ...(t.includes("call") ? ["contains a call reference"] : [])],
      why: "A no or a stop request. Alerted only — suppression stays a manual decision.",
    };
  const forwarded =
    /^(\s*(fwd|fw|re\s*fw)\s*:)/i.test(subject) ||
    /-{2,}\s*forwarded message\s*-{2,}/i.test(String(text || "")) ||
    !!meta.senderIsNew;
  const forwardNote = forwarded
    ? [
        meta.senderIsNew
          ? "new sender on a known thread"
          : "forwarded message",
      ]
    : [];
  /* Content decides the class; a forward or a new sender is a note on top of it,
   * never a reason to hide real interest. */
  const scored = urgentScore(text, meta.extraWords || "");
  const hints = INTEREST_HINTS.filter((w) => t.includes(w));
  if (scored.tier === "URGENT")
    return {
      class: "INTERESTED",
      tier: "URGENT",
      hits: [...scored.hits, ...forwardNote],
      why: "Asks for immediate contact." + (forwarded ? " New name on this thread — check who it is." : ""),
    };
  if (scored.tier === "HIGH" || hints.length >= 1)
    return {
      class: "INTERESTED",
      tier: scored.tier || "HIGH",
      hits: [...scored.hits, ...hints.slice(0, 3), ...forwardNote],
      why: "Sounds like real interest — alert, then you decide.",
    };
  if (forwarded)
    return {
      class: "FORWARD",
      tier: null,
      hits: forwardNote,
      why: "Someone new may be on this thread — read before answering.",
    };
  return { class: "NORMAL", tier: null, hits: [], why: "Stored for your weekly skim." };
}
export function phraseGaps(replies, known = []) {
  const stop = new Set(
    ("the a an and or but if then this that these those you your we our us i me my to for from with about at on in of is are was were be been have has had do does did will would can could should not no yes thanks thank please hi hello regards best dear it its as by so very just also more most her him they them their there here what when where who how all any because into over under again out up down off only own same than too".split(
      " ",
    )),
  );
  const counts = new Map();
  for (const r of replies || []) {
    for (const w of String(r.body || r.snippet || "")
      .toLowerCase()
      .split(/[^a-z']+/)) {
      if (w.length < 4 || stop.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  const knownText = known.join(" ").toLowerCase();
  return [...counts.entries()]
    .filter(([w, n]) => n >= 2 && !knownText.includes(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));
}

/* ------------------------------------------------------- email verification --- *
 * Honest levels: syntax → domain has mail servers (MX) → role address warning.
 * "MX exists" means the domain accepts mail; it is not proof a mailbox is live.
 */
export const ROLE_PREFIXES = [
  "info", "hello", "hi", "contact", "enquiries", "enquiry", "sales", "support",
  "admin", "office", "mail", "help", "service", "team", "accounts", "billing",
  "jobs", "careers", "marketing", "press", "no-reply", "noreply", "donotreply",
];
export const DISPOSABLE_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "throwawaymail.com", "yopmail.com", "trashmail.com", "sharklasers.com",
  "getnada.com", "dispostable.com", "maildrop.cc",
];
export function emailSyntaxOk(email) {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(String(email || ""));
}
export function emailTraits(email) {
  const e = String(email || "").toLowerCase();
  const [local, domain] = e.split("@");
  return {
    role: ROLE_PREFIXES.includes(String(local || "").split(/[._-]/)[0]),
    disposable: DISPOSABLE_DOMAINS.includes(domain),
    freeMail: ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "protonmail.com"].includes(domain),
  };
}
export function emailStatus(email, mxFound) {
  if (!emailSyntaxOk(email)) return "INVALID_SYNTAX";
  const traits = emailTraits(email);
  if (traits.disposable) return "DISPOSABLE";
  if (mxFound === false) return "NO_MAIL_SERVER";
  if (mxFound === true) return traits.role ? "MX_OK_ROLE" : "MX_OK";
  return "SYNTAX_OK";
}
export const EMAIL_STATUS_LABEL = {
  MX_OK: "Mail server found (not a delivery proof)",
  MX_OK_ROLE: "Mail server found · shared/role address",
  SYNTAX_OK: "Format looks right · mail server not checked",
  NO_MAIL_SERVER: "Domain does not accept mail",
  DISPOSABLE: "Throwaway address",
  INVALID_SYNTAX: "Invalid format",
};
export function bestEmail(candidates = []) {
  const rank = (s) => ["MX_OK", "MX_OK_ROLE", "SYNTAX_OK", "DISPOSABLE", "NO_MAIL_SERVER", "INVALID_SYNTAX"].indexOf(s);
  return [...candidates]
    .filter((c) => c.email && emailSyntaxOk(c.email))
    .sort((a, b) => rank(a.status) - rank(b.status) || a.email.length - b.email.length)[0] || null;
}

/* --------------------------------------------------- research-based outreach --- *
 * The draft opens with something actually observed in the research record, then one
 * clear question. No exclamation marks, no fake familiarity, no invented problems.
 */
export const PLATFORM_LABEL = {
  wordpress: "WordPress",
  woocommerce: "WooCommerce",
  shopify: "Shopify",
  wix: "Wix",
  squarespace: "Squarespace",
  godaddy: "GoDaddy",
  custom: "a custom build",
  unknown: "",
};
export function observation(lead = {}) {
  const out = [];
  const p = PLATFORM_LABEL[String(lead.platform || "").toLowerCase()];
  if (p) out.push(`the site is built on ${p}`);
  if (lead.analytics === false)
    out.push("I could not see a Google Analytics or Tag Manager tag in the page source");
  else if (lead.analytics === true)
    out.push("the site already loads Google Tag Manager or Analytics");
  if (lead.hiringSignal) out.push("the site mentions that you are hiring");
  if (lead.socials && Object.values(lead.socials).filter(Boolean).length === 0 && lead.website)
    out.push("I could not find linked social profiles from the site");
  if (lead.siteLanguage && lead.siteLanguage !== "en")
    out.push(`the site is written in ${lead.siteLanguage.toUpperCase()}`);
  if (lead.address) out.push(`the business is based in ${String(lead.address).split(",").slice(-2).join(",").trim()}`);
  return out.slice(0, 2);
}
export function researchLine(lead = {}) {
  const obs = observation(lead);
  if (!obs.length) return "";
  const where = lead.company ? `While looking at ${lead.company}'s website` : "While looking at your website";
  return `${where}, I noticed ${obs.join(", and ")}. I have not audited your setup and I am not assuming anything is broken — I only read what the public page shows.`;
}
function listWords(arr = []) {
  const a = arr.map((x) => String(x).trim()).filter(Boolean);
  if (a.length <= 1) return a[0] || "";
  return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
}
const WORD_CASE = { wordpress: "WordPress", woocommerce: "WooCommerce", php: "PHP", acf: "ACF", ga4: "GA4", gtm: "GTM", seo: "SEO", api: "API", crm: "CRM" };
function sentenceCase(t = "") {
  const s = String(t).trim().replace(/\b(wordpress|woocommerce|php|acf|ga4|gtm|seo|api|crm)\b/gi, (m) => WORD_CASE[m.toLowerCase()] || m);
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
export function professionalOutreach(lead, settings) {
  const first = String(lead.person || "").split(" ")[0];
  const greeting = first ? `Hello ${first},` : "Hello,";
  const niche = (lead.niche || settings.niche || "website and reporting work").toLowerCase();
  const skills = listWords(settings.skills || []) || "websites, tracking and integrations";
  const line = researchLine(lead);
  const type = String(lead.type || "");
  const opening = type === "New business"
    ? `The reason I'm writing: you look like a business in its first months${lead.cityLabel ? " in " + lead.cityLabel : ""}. In that stage the website, the tracking behind it and someone who answers when it breaks are usually one job — that is the job I do.`
    : type === "Agency partner"
      ? `The reason I'm writing: agencies take on more work than their team can absorb, and the overflow is usually ${niche}, not strategy. If that happens to you, I can be the quiet pair of hands behind the scenes.`
      : type === "Freelancer partner"
        ? `The reason I'm writing: I work behind other freelancers when a project needs ${niche} alongside what they already do — your client stays yours.`
        : `The reason I'm writing: businesses in ${lead.country || "your market"} usually need ${niche} handled end-to-end — the site, the tracking behind it, and someone who answers when it breaks.`;
  return `${greeting}

I'm ${settings.ownerName}, a developer and analyst in Dhaka. I work on ${skills}.

${line ? line + "\n\n" : ""}${opening}

Would a short, specific example of similar work be useful? If it is not relevant, tell me and I won't follow up again.

Portfolio: ${settings.portfolio || ""}

Best,
${settings.ownerName}`;
}
/* ------------------------------------------------------------ name clean-up ---- *
 * Research titles often look like "Connect companies | CommissionCrowd" or
 * "Acme Ltd - Home | Facebook". Keep the business, drop the directory tail.
 */
export const DIRECTORY_DOMAINS = [
  "commissioncrowd.com", "semrush.com", "similarweb.com", "glassdoor.com",
  "crunchbase.com", "opencorporates.com", "companieshouse.gov.uk", "dnb.com",
  "bloomberg.com", "zoominfo.com", "apollo.io", "g2.com", "capterra.com",
  "trustpilot.com", "yelp.com", "yell.com", "bark.com", "checkatrade.com",
  "yellowpages.com", "thomsonlocal.com", "cylex", "hotfrog", "bizify",
  "manta.com", "sortlist.com", "designrush.com", "clutch.co", "upwork.com",
  "freelancer.com", "fiverr.com", "peopleperhour.com", "truelancer.com",
  "indeed.com", "glassdoor.co.uk", "reed.co.uk", "totaljobs.com", "monster.com",
];
const TITLE_TAIL = /\s*[|\-–—·:]\s*(home|official site|official website|welcome|about us|contact( us)?|facebook|instagram|linkedin|twitter|x|youtube|tiktok|yelp|trustpilot|review(s)?|profile|directory|listing|jobs?|careers)\s*$/i;
export function cleanCompanyName(title, url = "") {
  let t = String(title || "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}
  const brand = host.split(".")[0];
  const socialHost = /(facebook|instagram|linkedin|twitter|x|youtube|tiktok|trustpilot|yelp|foursquare|pinterest)\./.test(
    host + ".",
  );
  const parts = t.split(/\s*[|·]\s*|\s+[-–—]\s+/).map((x) => x.trim()).filter(Boolean);
  const flat = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
  const looksLikeBrand = (x) => brand.length > 2 && flat(x).includes(flat(brand));
  const directoryHost = DIRECTORY_DOMAINS.some((d) => host === d || host.endsWith("." + d));
  let chosen = parts[0] || t;
  if (directoryHost) {
    /* "Connect companies | CommissionCrowd" — the directory is not the business. */
    chosen = parts.find((x) => !looksLikeBrand(x)) || parts.find(looksLikeBrand) || parts[0] || t;
  } else if (socialHost) {
    chosen = parts[0] || t;
  } else if (brand) {
    const match = parts.find(looksLikeBrand);
    if (match) chosen = match;
  }
  chosen = chosen.replace(TITLE_TAIL, "").trim();
  const dropTail = /\b(directory|list of|top \d+|best \d+|companies in|find .* installers?)\b/i;
  if (dropTail.test(chosen) && parts.length > 1) chosen = parts[parts.length - 1];
  chosen = chosen.replace(/\s*[|\-–—·:,]\s*$/, "").trim();
  return chosen.slice(0, 120);
}
export function isDirectoryName(title, url = "") {
  const t = String(title || "").toLowerCase();
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}
  if (DIRECTORY_DOMAINS.some((d) => host === d || host.endsWith("." + d))) return true;
  return /\b(directory|list of \d+|top \d+ (businesses|companies|agencies)|find (an? )?\w+ (installers?|companies|near me)|b2b (leads?|database))\b/i.test(
    t,
  );
}
export const EMAIL_STATUS_ORDER = ["MX_OK", "MX_OK_ROLE", "SYNTAX_OK", "DISPOSABLE", "NO_MAIL_SERVER", "INVALID_SYNTAX"];
