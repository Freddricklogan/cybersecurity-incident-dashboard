# AUDIT — Cybersecurity Incident Dashboard (pre-refactor)

Audit of the previous build: `index.html` (page markup, 7 inline
`onclick` handlers), `js/dashboard.js` (236 lines), `js/mitre.js` (83
lines), `css/style.css`, `data/incidents.json` (53 records) and
`data/mitre-mapping.json` (35 techniques). The data were consistent —
every incident's technique exists in the mapping with the right tactic,
now asserted by a test — so the findings are about what the page claimed,
what it could not do, and what a strict policy could not run.

---

## A. Honesty of the copy

### A1 — "System Active" and a ticking clock
`index.html:29–30` showed a green "System Active" badge and a live clock
(`dashboard.js:232`) beside 53 static records. Nothing was monitored.
**Fix:** removed; the shell tagline and the footer say the data are
synthetic and nothing is live.

### A2 — No response-time statistics despite shipping them
Every record carried `response_time_hours`; the page never aggregated it.
**Fix:** median response overall and by severity, and an unresolved
count, computed in `stats()` and tested against hand values.

## B. Correctness

### B1 — High and Medium drawn in the same colour
`dashboard.js:53`: `['#c0392b', '#b5842a', '#b5842a', '#1f4e8c']` — two
severities indistinguishable in the donut and the timeline. **Fix:** one
colour per severity, shared by the cards, charts, badges and heatmap.

### B2 — Timeline skipped empty months
Months with no incidents were absent from the x-axis, so a quiet quarter
compressed into nothing. **Fix:** `monthlySeries()` fills every month
between the first and last record; tested on a gapped fixture.

### B3 — Sorting compared strings for severity and status
`sortTable('severity')` ordered alphabetically (Critical, High, Low,
Medium). **Fix:** rank-ordered comparators with a stable time tiebreak.

### B4 — Heatmap silently dropped unmapped techniques
`mitre.js:29–35` ignored any technique absent from the mapping, so a new
technique in the data disappeared from the heatmap without a trace.
**Fix:** `heatmap()` returns `unmapped` and the page prints it; a test
asserts the shipped data has none.

## C. Security and policy

### C1 — Inline handlers, no CSP, unpinned CDN without integrity
`onclick="sortTable(...)"` on seven headers (`index.html:118`), six
`style=` attributes (line 136), Chart.js 4.4.1 with no `integrity`
(line 9), no Content-Security-Policy. **Fix:** strict CSP, event
listeners in `src/main.js`, Chart.js 3.9.1 pinned with SRI and vendored.

### C2 — Records rendered with `innerHTML`
`dashboard.js:138` and `mitre.js:66` interpolated titles, technique names
and descriptions into HTML. With STIX import now accepting a user's file,
that would be a stored-XSS path. **Fix:** every cell and heatmap tile is
built with `textContent`.

## D. Structure

### D1 — Globals and window-scoped functions
`window.renderMitreHeatmap`, `window.sortTable`, chart instances on
`window`, and module-level `let allIncidents` (`dashboard.js:1, 45, 236;
mitre.js:8`). A race between the two scripts meant the heatmap rendered
blank if `mitre-mapping.json` arrived after `incidents.json`
(`mitre.js:9`). **Fix:** both files are awaited together in `boot()`; the
pure modules `src/{incidents,attack,stix}.js` carry 14 tests.

### D2 — No interchange
The blueprint asked for STIX 2.1 import and an ATT&CK Navigator layer
export; neither existed. **Fix:** `navigatorLayer()` (layer format 4.5,
scored by incident count) and `toStixBundle()` / `fromStixBundle()`
(incident SDOs, `uses` relationships, attack-pattern SDOs with MITRE
external references); a test round-trips all 53 records.
