# MoCode Finder — Deployment & Maintenance Guide

Guided lookup tool that takes UMKC Conservatory staff from a plain-English
description of a transaction to the correct MoCode (and, secondarily, account
code) under the FY27 financial taxonomy. Currently hosted at
courtneycrappell.com/mocodes; prepared for handoff to UMKC IT for deployment
on the Conservatory apps pages (conservatoryapps.umkc.edu).

**Owner / contact:** Courtney Crappell, Dean, UMKC Conservatory —
cjchgy@umsystem.edu (also the destination of the in-app feedback links).

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | The entire application — markup, styles, and script in one file |
| `mocodes.json` | Data: all 67 MoCodes (DeptID, Program, Fund, HEADS mapping, accounts, guidance) plus compensation worker-type rules |
| `accounts.json` | Data: account codes organized by expense category for the built-in account-code browser (any fund: operating, gift, endowment, grant) |
| `seaMonkeys.png` | Footer badge image linking to courtneycrappell.com — an internal team in-joke; safe to delete (and remove the footer `<a class="easter-egg">` block) for institutional hosting |

## Deployment

Static files only. No build step, no server-side code, no dependencies,
no analytics, no cookies, no user data collected or stored.

1. Copy the folder to any static web host.
2. Serve `index.html`. The app fetches `mocodes.json` and `accounts.json`
   from its own directory, so it must be served over HTTP(S), not opened
   as a `file://` URL.
3. No special headers required. A restrictive CSP is compatible: the page
   uses inline styles/scripts (`'unsafe-inline'`) and same-origin fetch only.
   The only external navigation is the optional footer badge link.

## Updating the data

- MoCode changes: edit `mocodes.json`. Each entry's `mocode` field is the
  PeopleSoft identifier shown to users. Bump the top-level `lastUpdated`
  (shown in the footer).
- Account guidance changes: edit `accounts.json` (also has `lastUpdated`).
- Compensation worker types (`compensationRules` in `mocodes.json`) carry a
  `divisions` array controlling which divisions see each option.
- One duplication to know about: `index.html` hardcodes DeptIDs in the
  `divisionSubtitle()` map — update it if DeptIDs ever change.

The authoritative sources of truth are the Dean's Office spreadsheets
`Taxonomy_SOURCE_OF_TRUTH_7-28-2026.xlsx` and
`MoCodes_SOURCE_OF_TRUTH_7-29-2026.xlsx`.

## Accessibility conformance

Target: **WCAG 2.1 Level AA**, per the DOJ ADA Title II web accessibility
rule (28 CFR Part 35) and UM System digital accessibility policy.

Measures implemented (verified 2026-08-03):

- **Automated:** axe-core 4.10.2, WCAG 2.0/2.1 A+AA + best-practice rule
  sets, run on all 12 application screens — zero violations.
- **No change of context on input (3.2.2):** all decision options are
  buttons (explicit Enter/Space/click activation), not auto-advancing
  radios.
- **Keyboard (2.1.1):** fully operable by keyboard; no positive tabindex;
  collapsed accordion/details content is unfocusable; scrollable reference
  table is a focusable labeled region.
- **Focus management (2.4.3):** every screen change moves focus to that
  screen's heading; skip-to-content link (2.4.1).
- **Status messages (4.1.3):** results announced via a visually hidden
  `role="status"` live region.
- **Focus visible (2.4.7) / non-text contrast (1.4.11):** two-ring
  (gold + navy) focus indicator, ≥3:1 against both light and navy surfaces;
  transparent outline preserved for Windows High Contrast mode.
- **Structure (1.3.1):** landmark regions, heading hierarchy, `scope="col"`
  table headers, `aria-expanded`/`aria-controls` accordions, decorative
  emoji hidden with `aria-hidden`.
- **Text contrast (1.4.3):** verified by axe on every screen.
- **Motion:** `prefers-reduced-motion` disables transitions.
- **Reflow/zoom:** responsive single-column layout; no viewport zoom
  restrictions.

## Functional testing (2026-08-03)

- Programmatic sweep of all 106 decision paths (division × activity,
  production types, worker types, account categories) — every path reaches
  exactly one complete result.
- Role-based walkthroughs in Chrome: Music chair (faculty travel → KJ525),
  Dance chair (student accompanist → 703800/K9561, KJ523), Theatre chair
  (production royalties → KJ559), production manager (shared overhire →
  KJ561), Dean's Office staff (office supplies → KDH63), gift-fund purchase
  via the account browser (event catering → 728000).
