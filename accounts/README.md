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
3. No special headers required. A restrictive CSP is compatible: the page
   uses inline styles/scripts (`'unsafe-inline'`) and same-origin fetch only.
   The only external links are the mailto: feedback links and the relative
   link to the MoCode Finder.

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
  (gold + green) focus indicator, ≥3:1 against both the white cards and the
  green header; transparent outline preserved for Windows High Contrast mode.
- **Structure (1.3.1):** landmark regions, heading hierarchy, `scope="col"`
  table headers, decorative emoji hidden with `aria-hidden`.
- **Text contrast (1.4.3):** verified by axe on every screen. Note the header
  green (`#166534`) is darker than the MoCode Finder's navy, so muted text on
  it needs a higher alpha — tab labels and footer text are at 0.8 (≈5.2:1);
  0.7 measured 4.4:1 and failed.
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
