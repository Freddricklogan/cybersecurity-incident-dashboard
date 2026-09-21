/** Incident records: validation, filters, sorting and the statistics the dashboard reports. */

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
export const STATUSES = ['Open', 'Investigating', 'Contained', 'Resolved'];
const TECHNIQUE_ID = /^T\d{4}(\.\d{3})?$/;

/** Validates one raw record. Returns { incident } or { error } — never a half-parsed record. */
export function normalizeIncident(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'not an object' };
  const problems = [];
  const ts = Date.parse(raw.timestamp);
  if (!Number.isFinite(ts)) problems.push('timestamp is not an ISO date');
  if (!SEVERITIES.includes(raw.severity)) problems.push(`severity "${raw.severity}" is not one of ${SEVERITIES.join('/')}`);
  if (!STATUSES.includes(raw.status)) problems.push(`status "${raw.status}" is not one of ${STATUSES.join('/')}`);
  if (typeof raw.title !== 'string' || !raw.title.trim()) problems.push('title is required');
  if (typeof raw.attack_type !== 'string' || !raw.attack_type.trim()) problems.push('attack_type is required');
  if (!TECHNIQUE_ID.test(String(raw.mitre_technique))) problems.push(`mitre_technique "${raw.mitre_technique}" is not an ATT&CK id`);
  const hours = Number(raw.response_time_hours);
  if (!(hours >= 0)) problems.push('response_time_hours must be >= 0');
  if (problems.length) return { error: problems.join('; ') };
  return {
    incident: {
      id: raw.id ?? `${ts}-${raw.title}`,
      time: ts,
      title: raw.title.trim(),
      description: typeof raw.description === 'string' ? raw.description : '',
      severity: raw.severity,
      status: raw.status,
      attackType: raw.attack_type.trim(),
      technique: raw.mitre_technique,
      tactic: typeof raw.mitre_tactic === 'string' ? raw.mitre_tactic : '',
      systems: Array.isArray(raw.affected_systems) ? raw.affected_systems.map(String) : [],
      responseHours: hours
    }
  };
}

export function loadIncidents(rows) {
  if (!Array.isArray(rows)) throw new Error('incidents must be an array');
  const incidents = [];
  const rejected = [];
  rows.forEach((r, i) => {
    const out = normalizeIncident(r);
    if (out.incident) incidents.push(out.incident);
    else rejected.push({ index: i, error: out.error });
  });
  return { incidents, rejected };
}

export function filterIncidents(incidents, { start = null, end = null, severities = SEVERITIES, statuses = STATUSES, attackType = '' } = {}) {
  const startMs = start ? Date.parse(start) : -Infinity;
  const endMs = end ? Date.parse(`${end}T23:59:59.999Z`) : Infinity;
  return incidents.filter((i) => i.time >= startMs && i.time <= endMs && severities.includes(i.severity) && statuses.includes(i.status) && (!attackType || i.attackType === attackType));
}

const SEV_RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));
const STATUS_RANK = Object.fromEntries(STATUSES.map((s, i) => [s, i]));

export function sortIncidents(incidents, col = 'time', dir = -1) {
  const key = {
    time: (i) => i.time,
    title: (i) => i.title.toLowerCase(),
    severity: (i) => SEV_RANK[i.severity],
    status: (i) => STATUS_RANK[i.status],
    attackType: (i) => i.attackType.toLowerCase(),
    technique: (i) => i.technique,
    responseHours: (i) => i.responseHours
  }[col];
  if (!key) throw new RangeError(`unknown column ${col}`);
  return [...incidents].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka < kb) return -1 * dir;
    if (ka > kb) return 1 * dir;
    return a.time - b.time;
  });
}

export function median(xs) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stats(incidents) {
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const byType = {};
  const respBySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, []]));
  for (const i of incidents) {
    bySeverity[i.severity] += 1;
    byStatus[i.status] += 1;
    byType[i.attackType] = (byType[i.attackType] ?? 0) + 1;
    respBySeverity[i.severity].push(i.responseHours);
  }
  const open = incidents.filter((i) => i.status !== 'Resolved').length;
  return {
    total: incidents.length,
    bySeverity,
    byStatus,
    byType,
    open,
    medianResponseHours: median(incidents.map((i) => i.responseHours)),
    medianResponseBySeverity: Object.fromEntries(SEVERITIES.map((s) => [s, median(respBySeverity[s])])),
    monthly: monthlySeries(incidents)
  };
}

/** Incidents per calendar month (UTC) and severity, oldest first, with empty months filled in. */
export function monthlySeries(incidents) {
  if (incidents.length === 0) return [];
  const key = (ms) => new Date(ms).toISOString().slice(0, 7);
  const by = new Map();
  let min = Infinity;
  let max = -Infinity;
  for (const i of incidents) {
    const k = key(i.time);
    if (!by.has(k)) by.set(k, Object.fromEntries(SEVERITIES.map((s) => [s, 0])));
    by.get(k)[i.severity] += 1;
    min = Math.min(min, i.time);
    max = Math.max(max, i.time);
  }
  const out = [];
  const d = new Date(min);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  const last = key(max);
  for (;;) {
    const k = d.toISOString().slice(0, 7);
    out.push({ month: k, ...(by.get(k) ?? Object.fromEntries(SEVERITIES.map((s) => [s, 0]))) });
    if (k === last) break;
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}
