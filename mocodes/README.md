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

**`accounts.json` is shared.** The standalone Account Finder in the sibling
`../accounts/` folder fetches this same file rather than keeping its own copy,
so the two tools can't drift apart. Deploy the two folders as siblings, and
edit account guidance only here. See `../accounts/README.md`.

## Deployment

Static files only. No build step, no server-side code, no dependencies,
no analytics, no cookies, no user data collected or stored.

1. Copy the folder to any static web host.
2. Serve `index.html`. The app fetches `mocodes.json` and `accounts.json`
   from its own directory, so it must be served over HTTP(S), not opened
   as a `file://` URL.
3. **Content Security Policy — read this before deploying.** The app is a
   single file: one inline `<script>`, one inline `<style>`, and ~20 inline
   `onclick` handlers. It makes no external requests (same-origin fetch of its
   own JSON only; the sole outbound links are `mailto:`). But a policy that
   omits `'unsafe-inline'` for scripts and styles — and `'unsafe-hashes'` for
   the inline handlers — **stops the tool working entirely**, silently. If
   UMKC enforces a strict CSP, tell the owner: the fix is moving the script
   and styles to separate files and replacing the inline handlers with
   `addEventListener`, roughly an hour's work, not a redesign. Verify by
   loading the page and clicking "Get Started" — if nothing happens, it's CSP.

## Updating the data

- MoCode changes: edit `mocodes.json`. Each entry's `mocode` field is the
  PeopleSoft identifier shown to users. Bump the top-level `lastUpdated`
  (shown in the footer).
- Account guidance changes: edit `accounts.json` (also has `lastUpdated`).
- Compensation worker types (`compensationRules` in `mocodes.json`) carry a
  `divisions` array controlling which divisions see each option.
  Each rule also carries `mocodesByDivision` — a map of division → MoCode ID(s)
  (e.g. `"Theatre": ["KJ558", "KJ554"]`). The result screen resolves those IDs
  against `mocodes[]` to show the code and label, so the MoCode must exist there
  and the map's keys must match the `divisions` array.
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
