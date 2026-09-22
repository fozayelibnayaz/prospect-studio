import test from "node:test";
import assert from "node:assert/strict";
import { primary } from "../src/worker.js";

// Regression: rows that leaked into the live UK home-services discovery run
// on 2026-09-22 must be rejected as listicle/registry/directory sources.
test("rejects listicle, registry and data-broker pages (live leak regression)", () => {
  assert.equal(
    primary(
      "https://ensun.io/search/home-services/united-kingdom",
      "Top 100 Home Services Companies in United Kingdom (2026) | ensun",
    ),
    false,
  );
  assert.equal(
    primary(
      "https://find-and-update.company-information.gov.uk/company/12345678",
      "UK HOME SERVICES LTD overview - Find and update company information - GOV.UK",
    ),
    false,
  );
  assert.equal(
    primary(
      "https://uk-email-database.example-broker.net/top50",
      "Top 50 Home Services Companies in London - Emails & Contacts",
    ),
    false,
  );
  assert.equal(
    primary(
      "https://www.opencorporates.com/companies/gb/12345678",
      "Plumbing & Heating Ltd - OpenCorporates",
    ),
    false,
  );
  assert.equal(
    primary("https://www.somedirectory.com/plumbers", "UK plumber directory & business contacts"),
    false,
  );
});

test("accepts real business pages", () => {
  assert.equal(
    primary(
      "https://www.rightathome.co.uk/",
      "Right at Home UK - Homecare Assistance | National Provider",
    ),
    true,
  );
  assert.equal(primary("https://www.dinghome.co.uk/", "Home repairs | Ding"), true);
  assert.equal(
    primary("https://bristolplumbing.co.uk/contact", "Contact Bristol Plumbing & Heating"),
    true,
  );
  // A real firm with "B2B" in its name must NOT be filtered.
  assert.equal(
    primary(
      "https://abcb2bconsulting.co.uk/",
      "ABC B2B Consulting — software for trade businesses",
    ),
    true,
  );
  // A B2B leads database must still be filtered.
  assert.equal(
    primary(
      "https://ukb2bleadsdata.com/",
      "UK B2B Leads Database — 2 million verified contacts",
    ),
    false,
  );
});
