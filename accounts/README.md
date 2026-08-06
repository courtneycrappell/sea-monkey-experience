# Account Finder — Deployment & Maintenance Guide

Guided lookup that takes UMKC Conservatory staff from a plain-English
description of an expense to the correct **account code**, for any fund —
operating, gift, endowment, or grant. Companion to the MoCode Finder
(`../mocodes/`), which covers Fund 0000 operating transactions where a MoCode
is also required. Currently hosted at courtneycrappell.com/accounts; prepared
for handoff to UMKC IT for deployment on the Conservatory apps pages
(conservatoryapps.umkc.edu).

**Owner / contact:** Courtney Crappell, Dean, UMKC Conservatory —
cjchgy@umsystem.edu (also the destination of the in-app feedback links).

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | The entire application — markup, styles, and script in one file |
| `README.md` | This document |

**There is no data file here by design.** The app fetches
`../mocodes/accounts.json` — the same file the MoCode Finder's built-in account
browser reads. Both tools therefore always show identical guidance. Do not
reintroduce a local copy.

## Deployment

Static files only. No build step, no server-side code, no dependencies, no
analytics, no cookies, no user data collected or stored.

1. Copy this folder **and** the `mocodes/` folder to the static web host,
   preserving their relative positions as siblings — this app reads
   `../mocodes/accounts.json`. If the two tools must be deployed
   independently, change that one `fetch()` path in `index.html` to wherever
   `accounts.json` lives and note the new dependency here.
2. Serve `index.html`. Because it fetches JSON, it must be served over
   HTTP(S), not opened as a `file://` URL.
3. **Content Security Policy — read this before deploying.** The app is a
   single file: one inline `<script>`, one inline `<style>`, and inline
   `onclick` handlers. It makes no external requests (same-origin fetch of
   `../mocodes/accounts.json` only; outbound links are `mailto:` and the
   relative link to the MoCode Finder). But a policy that omits
   `'unsafe-inline'` for scripts and styles — and `'unsafe-hashes'` for the
   inline handlers — **stops the tool working entirely**, silently. If UMKC
   enforces a strict CSP, tell the owner: the fix is moving the script and
   styles to separate files and replacing the inline handlers with
   `addEventListener`. Verify by loading the page and clicking "Get Started" —
   if nothing happens, it's CSP.

## Updating the data

Edit `../mocodes/accounts.json` and bump its `lastUpdated` field, which both
tools display in the footer. Each account entry carries a `code`,
`description`, `why` (plain-language "use this when"), and `examples`.

The account list was curated from FY26 transaction history and cross-checked
against the UM System chart of accounts; it should be refreshed annually or
whenever new account types start appearing in transactions. System-generated
accounts (vendor discounts, bank service charges), revenue, benefits, and
student aid accounts are intentionally excluded — staff never select them.

The authoritative sources of truth for the taxonomy are the Dean's Office
spreadsheets `Taxonomy_SOURCE_OF_TRUTH_7-28-2026.xlsx` and
`MoCodes_SOURCE_OF_TRUTH_7-29-2026.xlsx`.

## Theme

Purple (`--blue: #6b21a8`, purple-800) as of 8/5/2026, so staff can tell at a
glance which tool they're in: the MoCode Finder is navy, this is purple, and
the recital generator is different again. The gold accent bar is shared across
Conservatory tools and stays. The CSS variable names still say `--blue` —
they're inherited from the MoCode Finder and hold the same roles, so the two
files stay easy to diff.

Any palette change has to be re-run through axe: the whole contrast record
below depends on these specific values.

## Accessibility conformance

Target: **WCAG 2.1 Level AA**, per the DOJ ADA Title II web accessibility rule
(28 CFR Part 35) and UM System digital accessibility policy.

Measures implemented (verified 2026-08-05):

- **Automated:** axe-core 4.10.2, WCAG 2.0/2.1 A+AA + best-practice rule sets,
  run on all 6 application screens — zero violations.
- **No change of context on input (3.2.2):** all decision options are buttons
  with explicit Enter/Space/click activation. They were previously radio
  inputs that advanced the flow on `change`, which moved keyboard users to the
  next screen as soon as they arrowed onto an option.
- **Keyboard (2.1.1):** fully operable by keyboard; no positive tabindex; the
  scrollable reference table is a focusable labeled region.
- **Focus management (2.4.3):** every screen change moves focus to that
  screen's heading; skip-to-content link (2.4.1).
- **Status messages (4.1.3):** results announced via a visually hidden
  `role="status"` live region.
- **Focus visible (2.4.7) / non-text contrast (1.4.11):** two-ring
  (gold + purple) focus indicator, ≥3:1 against both the white cards and the
  purple header; transparent outline preserved for Windows High Contrast mode.
- **Structure (1.3.1):** landmark regions, heading hierarchy, `scope="col"`
  table headers, decorative emoji hidden with `aria-hidden`.
- **Text contrast (1.4.3):** verified by axe on every screen after the 8/5
  purple repalette. Muted text on the header needs a higher alpha than the
  MoCode Finder uses — tab labels and footer text are at 0.8; 0.7 measured
  4.4:1 and failed. Key ratios: white on header purple 8.7:1, purple headings
  on white 8.7:1, gold focus ring against the header 5.3:1.
- **Motion:** `prefers-reduced-motion` disables transitions.
- **Reflow/zoom:** responsive single-column layout; no viewport zoom
  restrictions.
- **Browser history:** each screen is a history entry, so the browser Back
  button steps back through the questions instead of leaving the site.

## Functional testing (2026-08-05)

Programmatic sweep of all 43 decision paths (8 categories × their
subcategories, including both multi-account subcategories' expense-type step)
— every path reaches a complete result with an account code, name, "use this
when", and at least one example. Keyboard walkthrough confirmed focus lands on
each screen's heading and that focusing an option no longer navigates.
Cross-checked against the MoCode Finder's built-in browser: identical paths
return identical codes.

## Limits of this testing — please read before claiming conformance

The checks above are automated and structural. **They are not a conformance
audit, and this document is not a VPAT/ACR.** Automated tooling catches roughly
a third of WCAG issues; the rest need a human. Specifically, the following have
NOT been done:

- **No screen reader testing.** Nobody has run this through VoiceOver, NVDA, or
  JAWS. Semantics were verified structurally (roles, names, live regions,
  heading order), which is not the same as confirming it *announces sensibly*.
- **No manual keyboard walkthrough.** Focus behaviour was verified
  programmatically — focus lands on each screen's heading, no positive
  tabindex, nothing focusable inside hidden screens, options activate on
  Enter/Space rather than on arrow-key focus. A person has not tabbed through
  it end to end.
- **Chrome only.** No Safari, Firefox, or Edge testing. Safari matters most
  here: the browser-history handling and `focus({preventScroll})` differ
  subtly, and many staff are on Macs and iPhones.
- **No real devices.** Mobile layout was checked with emulated 375px and 320px
  viewports, not on hardware, and not with touch.
- **Browser zoom untested.** Narrow-viewport reflow passes, which is the same
  computation, but actual 200%/400% zoom was not exercised.
- **No accessibility statement page**, which UMKC policy may require, and no
  review by UMKC's accessibility office.

Recommended before or shortly after launch: a manual audit by UMKC's
accessibility office or an equivalent reviewer, covering screen reader,
keyboard-only, and zoom. Budget an hour; the app is six to twelve screens.

## What this tool cannot tell you

The tests confirm every path *reaches a complete answer*. They cannot confirm
the answer is *correct* — that KJ525 is genuinely the right code for a given
purchase. That comes from the chair validation sessions described in the PRD.
Coding guidance also depends on taxonomy questions that are still open with the
fiscal office (per-show tracking after the retirement of Project codes, whether
Ticketing K9010 needs a MoCode, and FY27 allocations that have not yet been
distributed across the new codes).
