/**
 * STIX 2.1 interchange. Export builds a bundle of `incident` SDOs (STIX 2.1 §4.9) linked by
 * `uses` relationships to `attack-pattern` SDOs carrying MITRE ATT&CK external references.
 * Severity and status have no core STIX property; they travel as `labels`
 * (`severity:high`, `status:resolved`) and as the `x_` extension properties below, and the
 * importer accepts either. Import validates and reports what it could not map.
 */
import { normalizeIncident, SEVERITIES, STATUSES } from './incidents.js';

const NS = '5f2a7b3c-0c9e-4b8b-9a1a-3c2e1d4f5a6b'; // stable UUID namespace for deterministic ids

/** Deterministic UUID v5-style id from a string (FNV-1a based; stable across runs, not cryptographic). */
export function stableId(prefix, text) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + NS.replace(/-/g, '').slice(0, 16)).slice(0, 32);
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return `${prefix}--${uuid}`;
}

function iso(ms) {
  return new Date(ms).toISOString();
}

export function toStixBundle(incidents, mapping, { created = Date.now() } = {}) {
  const objects = [];
  const patterns = new Map();
  for (const inc of incidents) {
    const tech = mapping?.techniques?.[inc.technique];
    let apId = patterns.get(inc.technique);
    if (!apId) {
      apId = stableId('attack-pattern', inc.technique);
      patterns.set(inc.technique, apId);
      objects.push({
        type: 'attack-pattern',
        spec_version: '2.1',
        id: apId,
        created: iso(created),
        modified: iso(created),
        name: tech?.name ?? inc.technique,
        description: tech?.description ?? '',
        kill_chain_phases: [{ kill_chain_name: 'mitre-attack', phase_name: (tech?.tactic ?? inc.tactic ?? '').toLowerCase().replace(/\s+/g, '-') }],
        external_references: [{ source_name: 'mitre-attack', external_id: inc.technique, url: `https://attack.mitre.org/techniques/${inc.technique.replace('.', '/')}/` }]
      });
    }
    const incId = stableId('incident', `${inc.id}|${inc.title}|${inc.time}`);
    objects.push({
      type: 'incident',
      spec_version: '2.1',
      id: incId,
      created: iso(inc.time),
      modified: iso(created),
      name: inc.title,
      description: inc.description,
      labels: [`severity:${inc.severity.toLowerCase()}`, `status:${inc.status.toLowerCase()}`, `attack-type:${inc.attackType.toLowerCase().replace(/\s+/g, '-')}`],
      x_severity: inc.severity,
      x_status: inc.status,
      x_attack_type: inc.attackType,
      x_affected_systems: inc.systems,
      x_response_time_hours: inc.responseHours
    });
    objects.push({
      type: 'relationship',
      spec_version: '2.1',
      id: stableId('relationship', `${incId}|uses|${apId}`),
      created: iso(created),
      modified: iso(created),
      relationship_type: 'uses',
      source_ref: incId,
      target_ref: apId
    });
  }
  return { type: 'bundle', id: stableId('bundle', `${incidents.length}|${created}`), objects };
}

function fromLabels(labels, key) {
  const l = (labels ?? []).find((x) => typeof x === 'string' && x.startsWith(`${key}:`));
  return l ? l.slice(key.length + 1) : null;
}
const SMALL_WORDS = new Set(['and', 'of', 'the', 'in']);
/** 'command-and-control' → 'Command and Control' (ATT&CK tactic spelling). */
const titleCase = (s) =>
  s
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');

/** Imports a STIX 2.1 bundle. Returns incidents plus a list of objects it skipped and why. */
export function fromStixBundle(bundle) {
  if (!bundle || bundle.type !== 'bundle' || !Array.isArray(bundle.objects)) throw new Error('not a STIX 2.1 bundle');
  const patterns = new Map();
  for (const o of bundle.objects) {
    if (o.type === 'attack-pattern') {
      const ref = (o.external_references ?? []).find((r) => r.source_name === 'mitre-attack' && r.external_id);
      if (ref) patterns.set(o.id, { technique: ref.external_id, tactic: titleCase(o.kill_chain_phases?.[0]?.phase_name ?? '') });
    }
  }
  const uses = new Map();
  for (const o of bundle.objects) if (o.type === 'relationship' && o.relationship_type === 'uses' && patterns.has(o.target_ref)) uses.set(o.source_ref, patterns.get(o.target_ref));
  const incidents = [];
  const skipped = [];
  for (const o of bundle.objects) {
    if (o.type !== 'incident') continue;
    const sevRaw = o.x_severity ?? fromLabels(o.labels, 'severity');
    const statusRaw = o.x_status ?? fromLabels(o.labels, 'status');
    const severity = SEVERITIES.find((s) => s.toLowerCase() === String(sevRaw).toLowerCase());
    const status = STATUSES.find((s) => s.toLowerCase() === String(statusRaw).toLowerCase());
    const tech = uses.get(o.id);
    const raw = {
      id: o.id,
      timestamp: o.created,
      title: o.name,
      description: o.description ?? '',
      severity,
      status,
      attack_type: o.x_attack_type ?? titleCase(fromLabels(o.labels, 'attack-type') ?? ''),
      mitre_technique: tech?.technique,
      mitre_tactic: tech?.tactic ?? '',
      affected_systems: o.x_affected_systems ?? [],
      response_time_hours: o.x_response_time_hours ?? 0
    };
    const out = normalizeIncident(raw);
    if (out.incident) incidents.push(out.incident);
    else skipped.push({ id: o.id, error: out.error });
  }
  return { incidents, skipped, objects: bundle.objects.length };
}
