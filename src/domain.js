export const defaults = {
  paused: true,
  autoSendOptIn: false,
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
};
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
  ])
    if (k in input) {
      if (typeof input[k] !== "boolean") throw Error("Invalid toggle");
      s[k] = input[k];
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
        createdAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
    });
  }
  return items;
}
export function makeFollowup(lead, settings, days, originalSubject) {
  const skills = settings.skills?.length ? settings.skills : defaults.skills;
  const skill = skills[(days + (lead.company || "").length) % skills.length];
  const subject = /^re:/i.test(String(originalSubject || ""))
    ? originalSubject
    : "Re: " + (originalSubject || "your website");
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
  { stage: "Lead discovery", people: "Find candidate businesses", status: "BUILT", note: "249 markets, broad/focused/adaptive, free quotas visible." },
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
