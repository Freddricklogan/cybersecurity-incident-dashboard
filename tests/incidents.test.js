import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filterIncidents, loadIncidents, median, monthlySeries, normalizeIncident, SEVERITIES, sortIncidents, stats } from '../src/incidents.js';

const raw = JSON.parse(readFileSync(new URL('../data/incidents.json', import.meta.url), 'utf8'));
const { incidents } = loadIncidents(raw);

describe('normalizeIncident / loadIncidents', () => {
  it('loads the shipped 53 incidents with none rejected', () => {
    const r = loadIncidents(raw);
    expect(r.incidents).toHaveLength(53);
    expect(r.rejected).toEqual([]);
    expect(r.incidents[0]).toMatchObject({ id: 1, title: 'Spear Phishing Campaign Targeting Finance', severity: 'Critical', status: 'Resolved', technique: 'T1566.001', responseHours: 2.5 });
  });
  it('rejects records with every problem named', () => {
    const r = normalizeIncident({ timestamp: 'yesterday', severity: 'Extreme', status: 'Done', title: ' ', attack_type: '', mitre_technique: 'X1', response_time_hours: -1 });
    expect(r.error).toMatch(/timestamp/);
    expect(r.error).toMatch(/severity "Extreme"/);
    expect(r.error).toMatch(/status "Done"/);
    expect(r.error).toMatch(/title/);
    expect(r.error).toMatch(/attack_type/);
    expect(r.error).toMatch(/mitre_technique "X1"/);
    expect(r.error).toMatch(/response_time_hours/);
    expect(normalizeIncident(null).error).toBe('not an object');
    expect(() => loadIncidents({})).toThrow(/array/);
    expect(loadIncidents([raw[0], { bad: true }]).rejected).toEqual([{ index: 1, error: expect.stringContaining('timestamp') }]);
  });
});

describe('filterIncidents', () => {
  it('filters by date range (inclusive), severity, status and attack type', () => {
    expect(filterIncidents(incidents, { start: '2026-01-01' }).every((i) => i.time >= Date.parse('2026-01-01'))).toBe(true);
    const march = filterIncidents(incidents, { start: '2025-03-15', end: '2025-03-15' });
    expect(march.some((i) => i.id === 1)).toBe(true);
    expect(filterIncidents(incidents, { severities: ['Critical'] })).toHaveLength(15);
    expect(filterIncidents(incidents, { statuses: ['Open'] })).toHaveLength(3);
    expect(filterIncidents(incidents, { attackType: 'Phishing' }).every((i) => i.attackType === 'Phishing')).toBe(true);
    expect(filterIncidents(incidents, { severities: [] })).toEqual([]);
  });
});

describe('sortIncidents', () => {
  it('sorts by each column with severity in rank order and rejects unknown columns', () => {
    const bySev = sortIncidents(incidents, 'severity', 1);
    expect(bySev[0].severity).toBe('Critical');
    expect(bySev[bySev.length - 1].severity).toBe('Low');
    const byTime = sortIncidents(incidents, 'time', -1);
    expect(byTime[0].time).toBeGreaterThanOrEqual(byTime[1].time);
    const byResp = sortIncidents(incidents, 'responseHours', 1);
    expect(byResp[0].responseHours).toBe(0.3);
    expect(sortIncidents(incidents, 'title', 1)[0].title.toLowerCase() <= sortIncidents(incidents, 'title', 1)[1].title.toLowerCase()).toBe(true);
    expect(() => sortIncidents(incidents, 'nope')).toThrow(RangeError);
    expect(incidents).toHaveLength(53); // not mutated
  });
});

describe('stats and monthlySeries', () => {
  it('counts by severity, status and type, and medians by hand', () => {
    const s = stats(incidents);
    expect(s.total).toBe(53);
    expect(s.bySeverity).toEqual({ Critical: 15, High: 19, Medium: 16, Low: 3 });
    expect(s.byStatus).toEqual({ Open: 3, Investigating: 3, Contained: 3, Resolved: 44 });
    expect(s.open).toBe(9);
    expect(Object.values(s.byType).reduce((a, b) => a + b, 0)).toBe(53);
    expect(s.medianResponseHours).toBe(median(incidents.map((i) => i.responseHours)));
    for (const sev of SEVERITIES) expect(Number.isFinite(s.medianResponseBySeverity[sev])).toBe(true);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
  it('fills empty months between the first and last incident', () => {
    const mk = (ts, severity) => ({ time: Date.parse(ts), severity });
    const series = monthlySeries([mk('2025-01-10', 'High'), mk('2025-04-02', 'Low'), mk('2025-04-20', 'High')]);
    expect(series.map((m) => m.month)).toEqual(['2025-01', '2025-02', '2025-03', '2025-04']);
    expect(series[3]).toEqual({ month: '2025-04', Critical: 0, High: 1, Medium: 0, Low: 1 });
    expect(monthlySeries([])).toEqual([]);
    expect(stats(incidents).monthly[0].month).toBe('2025-03');
    expect(stats(incidents).monthly[stats(incidents).monthly.length - 1].month).toBe('2026-03');
  });
});
