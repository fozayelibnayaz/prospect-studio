/* v0.3 pilot: scheduled NEW business discovery. No mail sender, no private-data AI.
 * Requires existing owner_, sheet_, readState_, ProspectResearchCore, prospectHeaders_.
 * API keys only in Script Properties. KEYLESS is explicitly supported by Tavily.
 */
var AutoProspect = (function () {
  var markets = [
    {
      name: "United Kingdom",
      cities: [
        "Bristol",
        "Manchester",
        "Leeds",
        "Sheffield",
        "Nottingham",
        "Cardiff",
        "Birmingham",
        "Liverpool",
        "Leicester",
        "Brighton",
        "York",
        "Bath",
      ],
    },
    {
      name: "Australia",
      cities: [
        "Brisbane",
        "Adelaide",
        "Perth",
        "Melbourne",
        "Sydney",
        "Newcastle",
        "Geelong",
        "Canberra",
      ],
    },
    {
      name: "Bangladesh",
      cities: [
        "Dhaka",
        "Chattogram",
        "Sylhet",
        "Khulna",
        "Rajshahi",
        "Gazipur",
      ],
    },
  ];
  var sectors = [
    "independent plumbing heating business",
    "independent home renovation company",
    "education admissions consultancy",
    "independent cafe restaurant",
    "independent online gift shop",
    "local tour operator travel business",
    "property management business",
    "independent furniture shop",
  ];
  var denied = [
    "google.com",
    "google.co.uk",
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "x.com",
    "twitter.com",
    "youtube.com",
    "tiktok.com",
    "trustpilot.com",
    "trustpilot.co.uk",
    "checkatrade.com",
    "reviews.io",
    "birdeye.com",
    "bark.com",
    "houzz.com",
    "yelp.com",
    "yell.com",
    "tripadvisor.com",
    "clutch.co",
    "designrush.com",
    "upwork.com",
    "freelancer.com",
    "fiverr.com",
    "indeed.com",
    "ziprecruiter.com",
    "reddit.com",
    "wikipedia.org",
    "amazon.com",
    "etsy.com",
    "jobs.wordpress.net",
    "wpcareerhub.com",
    "weworkremotely.com",
    "remoteok.com",
    "ensun.io",
    "opencorporates.com",
    "crunchbase.com",
    "zoominfo.com",
    "apollo.io",
    "lusha.com",
    "rocketreach.co",
    "contactout.com",
    "signalhire.com",
    "theorg.com",
    "kudagraph.com",
    "wiza.io",
    "datanyze.com",
    "leadgenius.com",
    "b2match.com",
    "dnb.com",
    "northdata.com",
    "companieshouse.gov.uk",
    "company-information.gov.uk",
    "companyhouse.co.uk",
  ];
  function text(v, max) {
    return String(v || "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
      .slice(0, max || 1000);
  }
  function url(v) {
    var s = String(v || "").trim();
    if (s.length > 1800 || /[\s\\<>"'\u0000-\u001f]/.test(s))
      throw new Error("UNSAFE_URL");
    var m = s.match(/^https:\/\/([a-zA-Z0-9.-]+)(?::443)?(\/[^#]*)?(?:#.*)?$/);
    if (!m) throw new Error("HTTPS_PUBLIC_URL_REQUIRED");
    var h = m[1].toLowerCase();
    if (
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
        h,
      ) ||
      !/[a-z]{2,}$/.test(h) ||
      /(^|\.)(localhost|local|localdomain|internal|lan|home|onion|arpa|test|example|invalid)$/.test(
        h,
      ) ||
      /(^|\.)(nip\.io|sslip\.io|localtest\.me)$/.test(h)
    )
      throw new Error("UNSAFE_HOST");
    if (
      /\/(login|signin|account|checkout|cart|admin|wp-admin)(\/|\?|$)/i.test(
        m[2] || "",
      )
    )
      throw new Error("NON_PUBLIC_PATH");
    return "https://" + h + (m[2] || "/");
  }
  function host(u) {
    return url(u)
      .match(/^https:\/\/([^/]+)/)[1]
      .replace(/^www\./, "");
  }
  function domain(u) {
    var h = host(u),
      bits = h.split("."),
      tail = bits.slice(-2).join(".");
    var base = bits
      .slice(
        /^(co\.uk|org\.uk|com\.au|net\.au|org\.au|com\.bd|org\.bd|co\.nz|co\.za|co\.in)$/.test(
          tail,
        )
          ? -3
          : -2,
      )
      .join(".");
    var aliases = {
      "thedairyagency.co.uk": "stencil-agency.co.uk",
      "hallaminternet.com": "hallam.agency",
      "builtvisible.com": "bravebison.com",
      "10up.com": "fueled.com",
    };
    return aliases[base] || base;
  }
  function allowed(u) {
    try {
      var h = host(u);
      return !denied.some(function (d) {
        return h === d || h.endsWith("." + d);
      });
    } catch (e) {
      return false;
    }
  }
  function query(cursor, day) {
    var i = Math.max(0, Math.floor(Number(cursor) || 0)),
      m = markets[i % markets.length];
    var city = m.cities[Math.floor(i / markets.length) % m.cities.length];
    var sector = sectors[i % sectors.length],
      mode = (i + Math.floor(i / sectors.length)) % 4;
    var intent =
      mode === 0
        ? "official website contact"
        : mode === 1
          ? "new opening launched official business contact"
          : mode === 2
            ? "online booking enquiry services official website contact"
            : "seeking freelance WordPress developer website redesign analytics project";
    return {
      query:
        (mode === 3
          ? "business " + city + " " + m.name + " " + intent
          : sector + " " + city + " " + m.name + " " + intent) +
        " -site:facebook.com -site:linkedin.com -site:yelp.com -site:clutch.co",
      market: m.name,
      segment: mode === 3 ? "public project request" : sector,
      mode: mode,
      day: day,
    };
  }
  function candidates(body, context, known) {
    if (!body || !Array.isArray(body.results))
      throw new Error("SEARCH_SCHEMA_INVALID");
    var added = [],
      seen = Object.create(null),
      skipped = 0;
    body.results.slice(0, 10).forEach(function (r) {
      if (!r || !allowed(r.url)) {
        skipped++;
        return;
      }
      var d = domain(r.url);
      if (known[d] || seen[d]) {
        skipped++;
        return;
      }
      var label = text(r.title, 180).trim();
      if (
        /\b(directory|trustpilot|checkatrade|top \d+|best \d+|how to|marketing for|web design for)\b/i.test(
          label,
        )
      ) {
        skipped++;
        return;
      }
      if (!label) {
        skipped++;
        return;
      }
      seen[d] = true;
      added.push({
        url: url(r.url),
        domain: d,
        label: label,
        query: context.query,
        market: context.market,
        segment: context.segment,
        mode: context.mode,
      });
    });
    return { items: added, skipped: skipped };
  }
  function geo(market, content, u) {
    var h = host(u),
      t = String(content || "");
    if (
      market === "United Kingdom" &&
      (/\.uk$/.test(h) ||
        /\bUnited Kingdom\b|\b[A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2}\b/.test(t))
    )
      return "MATCH";
    if (market === "Australia" && (/\.au$/.test(h) || /\bAustralia\b/.test(t)))
      return "MATCH";
    if (
      market === "Bangladesh" &&
      (/\.bd$/.test(h) || /\bBangladesh\b/.test(t))
    )
      return "MATCH";
    if (
      /\bUnited States\b|\bUSA\b|Bristol,?\s+(PA|CT)|Melbourne,?\s+FL/.test(t)
    )
      return "OTHER_MARKET";
    return "UNVERIFIED";
  }
  function contactUrl(content, base) {
    var re = /\[([^\]]{1,100})\]\(([^\s)]+)\)/g,
      m,
      options = [];
    while ((m = re.exec(String(content || "")))) {
      if (!/contact|get in touch/i.test(m[1])) continue;
      var candidate = m[2];
      if (candidate[0] === "/" && candidate[1] !== "/")
        candidate = "https://" + host(base) + candidate;
      if (
        allowed(candidate) &&
        domain(candidate) === domain(base) &&
        candidate !== base &&
        !candidate.includes("?")
      )
        options.push(candidate);
    }
    return (
      options.sort(function (a, b) {
        return a.length - b.length;
      })[0] || ""
    );
  }
  function parsePage(raw, u, market) {
    var t = text(raw, 70000),
      emails = [],
      phones = [],
      m,
      re;
    re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    while ((m = re.exec(t))) {
      var em = m[0].toLowerCase();
      if (
        !/^(privacy|dpo|abuse|noreply|no-reply|legal|data)@/.test(em) &&
        !/@(example\.(com|org)|email\.com|domain\.com)$/.test(em) &&
        emails.indexOf(em) < 0
      )
        emails.push(em);
    }
    re = /tel:(\+?[0-9 ()%.-]{8,35})/gi;
    while ((m = re.exec(t))) {
      var ph;
      try {
        ph = decodeURIComponent(m[1]).replace(/[^0-9+]/g, "");
      } catch (e) {
        continue;
      }
      if (
        ph.replace(/\D/g, "").length >= 8 &&
        ph.replace(/\D/g, "").length <= 15 &&
        phones.indexOf(ph) < 0
      )
        phones.push(ph);
    }
    if (!phones.length) {
      m = t.match(
        /(?:telephone|phone|call us|tel)\s*[:\-]?\s*(\+?[0-9][0-9 ()-]{7,23}[0-9])/i,
      );
      if (
        m &&
        m[1].replace(/\D/g, "").length >= 8 &&
        m[1].replace(/\D/g, "").length <= 15
      )
        phones.push(m[1].trim());
    }
    var address = "",
      lines = t.split("\n");
    for (var i = 0; i < lines.length; i++)
      if (
        /^\s*(?:#+\s*)?(?:Our (?:business |office )?)?Address\s*:?\s*$/i.test(
          lines[i],
        )
      ) {
        address = lines
          .slice(i + 1, i + 5)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 240);
        break;
      }
    if (!address) {
      for (var j = 0; j < lines.length; j++) {
        var line = lines[j]
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .replace(/[|*]/g, "")
            .replace(/\s+/g, " ")
            .trim(),
          post = line.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2}\b/);
        if (
          post &&
          /\b(road|street|rd|st|lane|avenue|way|drive|square|court|park|terrace|close)\b/i.test(
            line,
          )
        ) {
          address = line.slice(
            Math.max(0, post.index - 160),
            post.index + post[0].length,
          );
          break;
        }
      }
    }
    var person = t.match(
      /\b(?:[Ff]ounded|[Oo]wned|[Rr]un) by\s+([A-Z][a-z]{1,20}(?:[ -][A-Z][a-z]{1,20}){1,3})/,
    );
    var flags = {
      business:
        /\b(contact|services|shop|book online|enquiries|restaurant|cafe|plumbing|consultancy|furniture|tours|property management)\b/i.test(
          t,
        ),
      request:
        /\b(we (?:are )?(?:looking for|need|seek)|seeking a|request for proposal)\b[\s\S]{0,160}\b(wordpress|website|developer|analytics|dashboard)\b/i.test(
          t,
        ),
      newBusiness:
        /\b(newly opened|grand opening|we have launched|we recently launched|new location)\b/i.test(
          t,
        ),
      noOutsource:
        /\b(no offshore outsourcing|no freelancers|we do not outsource|we never outsource)\b/i.test(
          t,
        ),
    };
    var service =
      /\b(dashboard|reporting pipeline|Looker Studio|GA4|GTM|Google Tag Manager)\b/i.test(
        t,
      )
        ? "Analytics & reporting"
        : /\b(automation|workflow|integration)\b/i.test(t)
          ? "Workflow automation"
          : "WordPress delivery";
    return {
      url: u,
      email: emails[0] || "",
      phone: phones[0] || "",
      address: address,
      person: person ? person[1] : "",
      personEvidence: person ? text(person[0], 120) : "",
      geo: geo(market, t, u),
      flags: flags,
      service: service,
      contact: contactUrl(t, u),
    };
  }
  function merge(home, contact) {
    var r = JSON.parse(JSON.stringify(home));
    if (contact) {
      ["email", "phone", "address", "person", "personEvidence"].forEach(
        function (k) {
          if (contact[k]) {
            r[k] = contact[k];
            r[k + "Source"] = contact.url;
          }
        },
      );
      if (contact.geo === "MATCH") r.geo = "MATCH";
      r.flags.noOutsource = r.flags.noOutsource || contact.flags.noOutsource;
    }
    ["email", "phone", "address", "person"].forEach(function (k) {
      if (r[k] && !r[k + "Source"]) r[k + "Source"] = home.url;
    });
    return r;
  }
  function record(job, data, day, headers) {
    if (!allowed(job.URL) || !allowed(data.url))
      throw new Error("BLOCKED_SOURCE_DOMAIN");
    var r = {};
    headers.forEach(function (h) {
      r[h] = "";
    });
    var held =
      data.geo !== "MATCH" || !data.flags.business || data.flags.noOutsource;
    var signal = data.flags.request
      ? "POSSIBLE_WORK_REQUEST"
      : data.flags.newBusiness
        ? "POSSIBLE_NEW_BUSINESS"
        : "FIT_ONLY";
    var offer =
      data.service === "Analytics & reporting"
        ? "GA4/GTM event validation and reporting"
        : data.service === "Workflow automation"
          ? "a small reporting or API workflow"
          : "a scoped website/WordPress implementation";
    r.ID = job.ID;
    r.Company = job.Label;
    r.Website = job.URL;
    r.Niche = data.service;
    r["Lead type"] = held ? "HOLD_AUTOMATED_CHECK" : signal;
    r.Priority = held
      ? "HOLD — verify source/market"
      : "P2 — machine-researched, review fit";
    r["Suggested offer"] = offer;
    r["Fit assessment"] =
      "Offer hypothesis for " +
      job.Segment +
      ". No diagnosed defect, budget or buying intent is asserted.";
    r["Public contact name"] = data.person || "UNKNOWN";
    r["Contact role"] = data.person
      ? "Public founder/owner wording; verify authority"
      : "UNKNOWN";
    r["Public email"] = data.email || "UNKNOWN";
    r["Email source"] = data.emailSource || "";
    r["Email verification"] = data.email
      ? "Literal public-page text; business purpose and deliverability NOT verified"
      : "Not found in successfully extracted pages";
    r["Public phone"] = data.phone || "UNKNOWN";
    r["Phone source"] = data.phoneSource || "";
    r["Business address"] = data.address || "UNKNOWN";
    r["Address source"] = data.addressSource || "";
    r["Address note"] =
      "Machine-extracted address-like excerpt; may be incomplete. Not postal or legal verification.";
    r["Office / market"] = job.Market + "; source check " + data.geo;
    r["Evidence source"] = data.url;
    r["Evidence summary"] =
      "Automated primary-page extraction. " +
      (data.personEvidence
        ? data.personEvidence +
          "; source " +
          (data.personSource || data.url) +
          ". "
        : "") +
      "Signals: " +
      JSON.stringify(data.flags) +
      ". Query: " +
      job.Query;
    r["Checked on"] = day;
    r.Eligibility =
      "Remote engagement from Bangladesh and appropriate contact route not verified.";
    r.Limitations =
      "Business label is derived from search title. " +
      (held
        ? "HOLD: geography, business relevance or outsourcing policy needs review. "
        : "Fit only until reviewed. ") +
      "Keyword request/launch signals are not verified current opportunities. Public contact details are not consent. Website platform and actual needs unverified.";
    r["Recommended route"] = data.contact || data.url;
    r.Subject =
      "Website, reporting or workflow support — relevant to your plans?";
    r["Draft message"] = held
      ? "HOLD — do not contact until the source/market restriction is resolved."
      : "Hello,\n\nI’m Fozayel Ibn Ayaz, a Dhaka-based developer and analyst. I work on WordPress/PHP/ACF websites, tracking/reporting and tested integrations. If " +
        offer +
        " is part of your plans, I can share a relevant example and discuss a small paid scope. I have not audited your systems and am not assuming anything is broken.\n\nPortfolio: https://fozayelibnayaz.github.io/portfolio/\n\nIf this is not relevant, let me know and I won’t follow up.\n\nAyaz";
    r["Review status"] = held ? "HOLD" : "UNREVIEWED";
    r.Consent = "NONE";
    r.Outcome = "NOT_CONTACTED";
    return r;
  }
  function freeUsage(body, cost, paygoDisabledConfirmed) {
    var a = body && body.account;
    if (
      !a ||
      !["free", "researcher", "researcher (free)"].includes(
        String(a.current_plan).toLowerCase(),
      ) ||
      !Number.isInteger(a.plan_usage) ||
      a.plan_usage < 0 ||
      !Number.isInteger(a.plan_limit) ||
      a.plan_limit <= 0 ||
      a.plan_limit > 1000 ||
      !(
        a.paygo_limit === 0 ||
        (a.paygo_limit === null && paygoDisabledConfirmed === true)
      ) ||
      a.paygo_usage !== 0
    )
      throw new Error("FREE_PLAN_NOT_VERIFIED");
    if (a.plan_usage + cost > Math.min(950, a.plan_limit))
      throw new Error("PROVIDER_FREE_BUDGET_STOP");
    if (
      body.key &&
      typeof body.key.limit === "number" &&
      typeof body.key.usage === "number" &&
      body.key.usage + cost > body.key.limit
    )
      throw new Error("KEY_LIMIT_STOP");
    return true;
  }
  function budget(old, day, kind) {
    var b = JSON.parse(JSON.stringify(old || {})),
      month = day.slice(0, 7);
    if (b.month !== month) {
      b.month = month;
      b.monthUsed = 0;
    }
    if (b.day !== day) {
      b.day = day;
      b.search = 0;
      b.extract = 0;
      b.dayUsed = 0;
    }
    ["monthUsed", "search", "extract", "dayUsed"].forEach(function (k) {
      if (!Number.isFinite(b[k]) || b[k] < 0) throw new Error("BUDGET_CORRUPT");
    });
    if (!["search", "extract"].includes(kind))
      throw new Error("ENDPOINT_NOT_BUDGETED");
    if (
      b.monthUsed >= 900 ||
      b.dayUsed >= 28 ||
      b[kind] >= (kind === "search" ? 8 : 20)
    )
      throw new Error("LOCAL_BUDGET_STOP");
    b.monthUsed++;
    b.dayUsed++;
    b[kind]++;
    return b;
  }
  return {
    url: url,
    domain: domain,
    allowed: allowed,
    query: query,
    candidates: candidates,
    geo: geo,
    parsePage: parsePage,
    merge: merge,
    record: record,
    freeUsage: freeUsage,
    budget: budget,
    denied: denied,
  };
})();

export default AutoProspect;
