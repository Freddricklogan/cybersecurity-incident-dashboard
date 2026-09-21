import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { heatmap, navigatorLayer, techniqueCounts } from '../src/attack.js';
import { loadIncidents } from '../src/incidents.js';

const mapping = JSON.parse(readFileSync(new URL('../data/mitre-mapping.json', import.meta.url), 'utf8'));
const { incidents } = loadIncidents(JSON.parse(readFileSync(new URL('../data/incidents.json', import.meta.url), 'utf8')));

describe('mapping integrity', () => {
  it('every incident technique exists in the mapping with a matching tactic', () => {
    for (const i of incidents) {
      expect(mapping.techniques[i.technique], i.technique).toBeDefined();
      expect(mapping.techniques[i.technique].tactic).toBe(i.tactic);
    }
    expect(Object.keys(mapping.techniques)).toHaveLength(35);
  });
});

describe('heatmap', () => {
  it('groups by tactic in mapping order, sorts by count, conserves totals and reports unmapped', () => {
    const h = heatmap(mapping, incidents);
    expect(h.columns.map((c) => c.tactic)).toEqual(mapping.tactics.filter((t) => h.columns.some((c) => c.tactic === t)));
    const total = h.columns.flatMap((c) => c.techniques).reduce((s, t) => s + t.count, 0);
    expect(total).toBe(53);
    for (const c of h.columns) for (let i = 1; i < c.techniques.length; i += 1) expect(c.techniques[i - 1].count).toBeGreaterThanOrEqual(c.techniques[i].count);
    expect(h.unmapped).toEqual([]);
    expect(h.max).toBe(Math.max(...techniqueCounts(incidents).values()));
    const withUnknown = heatmap(mapping, [...incidents, { technique: 'T9999' }]);
    expect(withUnknown.unmapped).toEqual(['T9999']);
    expect(heatmap(mapping, []).max).toBe(1);
  });
});

describe('navigatorLayer', () => {
  it('produces a layer-format 4.5 document with one scored entry per technique', () => {
    const layer = navigatorLayer(incidents, { name: 'Test' });
    expect(layer.versions).toEqual({ attack: '14', navigator: '4.9.1', layer: '4.5' });
    expect(layer.domain).toBe('enterprise-attack');
    expect(layer.techniques.map((t) => t.techniqueID)).toEqual([...techniqueCounts(incidents).keys()].sort());
    expect(layer.techniques.reduce((s, t) => s + t.score, 0)).toBe(53);
    expect(layer.gradient.maxValue).toBe(Math.max(...layer.techniques.map((t) => t.score)));
    const sub = layer.techniques.find((t) => t.techniqueID === 'T1566.001');
    expect(sub.showSubtechniques).toBe(true);
    expect(sub.comment).toMatch(/incidents?$/);
    expect(JSON.parse(JSON.stringify(layer))).toEqual(layer);
  });
});
