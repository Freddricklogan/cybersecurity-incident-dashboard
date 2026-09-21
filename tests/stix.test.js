import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadIncidents } from '../src/incidents.js';
import { fromStixBundle, stableId, toStixBundle } from '../src/stix.js';

const mapping = JSON.parse(readFileSync(new URL('../data/mitre-mapping.json', import.meta.url), 'utf8'));
const { incidents } = loadIncidents(JSON.parse(readFileSync(new URL('../data/incidents.json', import.meta.url), 'utf8')));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

describe('stableId', () => {
  it('is deterministic, prefixed and UUID-shaped', () => {
    expect(stableId('incident', 'a')).toBe(stableId('incident', 'a'));
    expect(stableId('incident', 'a')).not.toBe(stableId('incident', 'b'));
    expect(stableId('incident', 'a').split('--')[1]).toMatch(UUID);
  });
});

describe('toStixBundle', () => {
  it('emits one incident, one relationship per incident and one attack-pattern per technique', () => {
    const b = toStixBundle(incidents, mapping, { created: Date.parse('2026-01-01T00:00:00Z') });
    expect(b.type).toBe('bundle');
    const by = (t) => b.objects.filter((o) => o.type === t);
    expect(by('incident')).toHaveLength(53);
    expect(by('relationship')).toHaveLength(53);
    expect(by('attack-pattern')).toHaveLength(new Set(incidents.map((i) => i.technique)).size);
    for (const o of b.objects) {
      expect(o.spec_version).toBe('2.1');
      expect(o.id.split('--')[1]).toMatch(UUID);
    }
    const ap = by('attack-pattern').find((o) => o.external_references[0].external_id === 'T1566.001');
    expect(ap.name).toBe('Spearphishing Attachment');
    expect(ap.kill_chain_phases[0]).toEqual({ kill_chain_name: 'mitre-attack', phase_name: 'initial-access' });
    const inc = by('incident')[0];
    expect(inc.labels).toContain('severity:critical');
    expect(inc.created).toBe('2025-03-15T08:23:00.000Z');
    expect(by('relationship').every((r) => r.relationship_type === 'uses')).toBe(true);
    expect(toStixBundle(incidents, mapping, { created: 1 })).toEqual(toStixBundle(incidents, mapping, { created: 1 }));
  });
});

describe('fromStixBundle', () => {
  it('round-trips the exported bundle back to the same incidents (id aside)', () => {
    const b = toStixBundle(incidents, mapping);
    const r = fromStixBundle(b);
    expect(r.skipped).toEqual([]);
    expect(r.incidents).toHaveLength(53);
    const strip = (i) => ({ ...i, id: null });
    expect(r.incidents.map(strip)).toEqual(incidents.map(strip));
  });
  it('accepts severity and status from labels when the x_ properties are absent', () => {
    const b = toStixBundle(incidents.slice(0, 2), mapping);
    for (const o of b.objects) if (o.type === 'incident') { delete o.x_severity; delete o.x_status; delete o.x_attack_type; }
    const r = fromStixBundle(b);
    expect(r.incidents).toHaveLength(2);
    expect(r.incidents[0].severity).toBe('Critical');
    expect(r.incidents[0].attackType).toBe('Phishing');
  });
  it('skips incidents it cannot map and rejects non-bundles', () => {
    const b = { type: 'bundle', id: 'bundle--x', objects: [{ type: 'incident', id: 'incident--1', created: '2026-01-01T00:00:00Z', name: 'No technique', labels: ['severity:high', 'status:open'] }] };
    const r = fromStixBundle(b);
    expect(r.incidents).toEqual([]);
    expect(r.skipped[0].error).toMatch(/mitre_technique/);
    expect(r.objects).toBe(1);
    expect(() => fromStixBundle({ type: 'report' })).toThrow(/bundle/);
  });
});
