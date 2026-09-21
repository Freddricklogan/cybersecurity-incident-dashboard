# Case Study — Cybersecurity Incident Dashboard

**Repository:** [cybersecurity-incident-dashboard](https://github.com/Freddricklogan/cybersecurity-incident-dashboard) · **Live demo:** [freddricklogan.github.io/cybersecurity-incident-dashboard](https://freddricklogan.github.io/cybersecurity-incident-dashboard/) · **Author:** Freddrick Logan

---

## 1. Who has this problem

Security teams at universities and public agencies reporting incidents upward without a commercial SIEM, the CIO or audit committee receiving the report, students in a security-operations course learning to map incidents to ATT&CK, and the consultant — I advise on cloud and security in higher education — asked whether a dashboard's numbers reconcile with the records behind it and can be carried into the tools the team already uses.

## 2. The problem, as a scenario

A CIO opens the incident dashboard before an audit meeting. A green badge says "System Active" and a clock ticks; the fifty-three records underneath were exported months ago. Two severities share one colour. The timeline hides the quiet summer because empty months were dropped. Sorting by severity lists Critical, High, Low, Medium. The auditor asks for ATT&CK coverage as a Navigator layer and the records as STIX to compare with the university system's feed; the dashboard exports neither. The previous version of this page was that dashboard. I wrote it; its audit is in the repository.

## 3. What it costs to leave it alone

A report that looks monitored and is not; a chart that hides High from Medium; a coverage picture nobody else can check; a student who learns the theatre before the discipline. I will not attach a figure — incident costs depend on the incident, and these records are synthetic. What is certain is that each defect is visible in an hour to a reader who knows the formats, and an auditor is that reader.

## 4. The approach, and the alternative I rejected

I rebuilt the page so every number is computed from the records and every format is one a team can use. Records are validated on load with each problem named. Filters for date, severity, status and attack type drive counts, an unresolved backlog, median response time overall and by severity, a monthly series with empty months filled, an attack-type ranking, an ATT&CK heatmap grouped by tactic, and a sortable log with rank-ordered severity. Two exports cover the incidents shown: an ATT&CK Navigator layer scored by incident count, and a STIX 2.1 bundle of incident objects linked by "uses" relationships to attack-pattern objects with MITRE external references. The importer reads the same bundle back, accepting severity and status from labels or extension properties; a test round-trips all fifty-three records. The status light and clock are gone; the page says the data are synthetic.

The alternative I rejected was more panels — geolocation, a threat-intel ticker, an "AI insights" box — each a decoration on data that could not yet leave the page. Interchange and reconciliation are what an audit needs.

## 5. What the code does today

Real: record validation with rejection reasons; filters, rank-ordered sorting, statistics and the filled monthly series; technique counts, the tactic-grouped heatmap with an unmapped-technique report, and Navigator layer export in layer format 4.5; STIX 2.1 export with deterministic ids and import with skipped-object reporting; Chart.js pinned with SRI plus a vendored fallback; the Executive Shell with KPIs from the filtered set; a strict content-security policy with no inline script, style or HTML built from data.

Simulated: the incidents. The fifty-three records are synthetic and dated 2025-03 to 2026-03; the technique mapping covers thirty-five techniques across twelve tactics, a teaching subset of ATT&CK, not the full matrix.

Worth knowing: severity and status are not core STIX properties, so the bundle carries them as labels and `x_` extensions, which the importer documents and accepts; the Navigator layer targets ATT&CK version 14 and should be checked against the Navigator release in use.

## 6. Evidence

Measured locally with the commands CI runs: 14 tests passing across three files; 100% statement and 92.54% branch coverage of the pure modules; ESLint and html-validate clean. Tests load all 53 records with none rejected, name every failure on a bad record, check the four filters, rank-ordered sorting, counts by severity (15/19/16/3) and status (3/3/3/44), medians by hand, month filling on a gapped fixture, mapping integrity, heatmap conservation and ordering, the Navigator layer's version, domain, scores and sub-technique flags, and a STIX round trip of all 53 records plus label-only import. Headless Chrome on the built page: zero console errors; 53 shown, 15 critical, 9 unresolved, median response 2.2 hours; 35 heatmap tiles with the hottest at 7 incidents; severity sort puts Critical first; excluding Low leaves 50; the Navigator layer exports 34 techniques scoring 50 and the STIX bundle 134 objects; five tour steps; no horizontal scroll at 1280 or 400 pixels.

## 7. What it would take to run this in production

As a teaching instrument and a reporting template it is production now. As an operational dashboard it would need a scheduled ticketing or SIEM export with an audit trail, identified users, the full ATT&CK matrix from MITRE's published STIX feed, and a review of the severity and status vocabulary against the team's runbook. Days of integration; validation, statistics and interchange carry over.

## 8. Limits and next steps

A teaching subset of ATT&CK, one-line records with no action timeline, medians without confidence, no period comparison. Next: the full matrix from MITRE's STIX bundle, per-incident action timelines with dwell time, a period-over-period view, and a Sigma-rule coverage overlay linking to the SIEM log analyzer in this portfolio.

## 9. Who should look at this

**Hiring manager:** evidence that I build security reporting that reconciles with its records and speaks ATT&CK and STIX, and that I remove theatre from my own earlier work.
**Consulting client:** a template for incident reporting to a board or auditor that can be checked against the source and exchanged with other tools.
**Engineer:** read `src/stix.js` and `tests/stix.test.js` for the bundle round trip, and `src/attack.js` for the Navigator layer.
