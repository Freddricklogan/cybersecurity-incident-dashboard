/** Wires incidents, filters, the ATT&CK heatmap, STIX interchange and the Executive Shell. */
import { heatmap, navigatorLayer } from './attack.js';
import { loadChartLib, makeCharts } from './charts.js';
import { mountExecShell } from './exec-shell.js';
import { filterIncidents, loadIncidents, SEVERITIES, sortIncidents, stats, STATUSES } from './incidents.js';
import { fromStixBundle, toStixBundle } from './stix.js';
import { $, dateLabel, el, hoursLabel, setText } from './ui.js';

const SEV_COLOUR = { Critical: '#f85149', High: '#d29922', Medium: '#58A6FF', Low: '#3fb950' };
const state = { all: [], mapping: null, filtered: [], stats: null, sort: { col: 'time', dir: -1 }, source: 'data/incidents.json' };
let charts = makeCharts(null);
let shell;

function currentFilter() {
  return {
    start: $('filter-date-start').value || null,
    end: $('filter-date-end').value || null,
    severities: SEVERITIES.filter((s) => $(`sev-${s}`).checked),
    statuses: STATUSES.filter((s) => $(`status-${s}`).checked),
    attackType: $('filter-attack-type').value
  };
}

function render() {
  state.filtered = filterIncidents(state.all, currentFilter());
  state.stats = stats(state.filtered);
  const s = state.stats;
  setText('stat-total', s.total);
  for (const sev of SEVERITIES) setText(`stat-${sev.toLowerCase()}`, s.bySeverity[sev]);
  setText('stat-open', s.open);
  setText('stat-mttr', hoursLabel(s.medianResponseHours));
  setText('mttr-by-sev', SEVERITIES.map((sev) => `${sev} ${hoursLabel(s.medianResponseBySeverity[sev])}`).join(' · '));
  setText('status-line', `${s.total} of ${state.all.length} incidents shown · source: ${state.source}`);

  charts.donut($('severityChart'), SEVERITIES, SEVERITIES.map((sev) => s.bySeverity[sev]), SEVERITIES.map((sev) => SEV_COLOUR[sev]));
  charts.line($('timelineChart'), s.monthly.map((m) => m.month), SEVERITIES.map((sev) => ({ label: sev, data: s.monthly.map((m) => m[sev]), colour: SEV_COLOUR[sev], fill: true })), 'Month', 'Incidents');
  const types = Object.entries(s.byType).sort((a, b) => b[1] - a[1]);
  charts.bars($('typeChart'), types.map((t) => t[0]), types.map((t) => t[1]), 'Incidents');

  renderHeatmap();
  renderTable();
  shell?.refreshKpis();
}

function renderHeatmap() {
  const grid = $('mitre-grid');
  grid.replaceChildren();
  if (!state.mapping) return;
  const h = heatmap(state.mapping, state.filtered);
  for (const col of h.columns) {
    const column = el('div', { class: 'mitre-column', role: 'group', 'aria-label': col.tactic });
    column.append(el('div', { class: 'tactic-header', text: col.tactic }));
    for (const t of col.techniques) {
      const cell = el('div', { class: `mitre-cell${t.count ? ' is-hot' : ''}`, tabindex: '0', title: `${t.id} ${t.name}: ${t.count} incident${t.count === 1 ? '' : 's'}. ${t.description}` });
      cell.style.setProperty('--heat', String(t.intensity));
      cell.append(el('span', { class: 'technique-id', text: t.id }), el('span', { class: 'technique-name', text: t.name }), el('span', { class: 'technique-count', text: t.count ? String(t.count) : '' }));
      column.append(cell);
    }
    grid.append(column);
  }
  setText('heatmap-note', h.unmapped.length ? `Techniques seen in incidents but missing from the mapping: ${h.unmapped.join(', ')}` : `${h.columns.length} tactics · ${h.columns.reduce((n, c) => n + c.techniques.length, 0)} techniques in the mapping · hottest technique has ${h.max} incident${h.max === 1 ? '' : 's'}`);
}

function renderTable() {
  const tbody = $('incident-tbody');
  tbody.replaceChildren();
  for (const i of sortIncidents(state.filtered, state.sort.col, state.sort.dir)) {
    const tr = el('tr');
    tr.append(
      el('td', { text: dateLabel(i.time) }),
      el('td', { text: i.title }),
      el('td', {}, [el('span', { class: `badge badge--${i.severity.toLowerCase()}`, text: i.severity })]),
      el('td', {}, [el('span', { class: `tag tag--${i.status.toLowerCase()}`, text: i.status })]),
      el('td', { text: i.attackType }),
      el('td', { text: i.technique }),
      el('td', { text: hoursLabel(i.responseHours) })
    );
    tbody.append(tr);
  }
  for (const b of document.querySelectorAll('button[data-col]')) {
    const on = b.dataset.col === state.sort.col;
    b.setAttribute('aria-sort', on ? (state.sort.dir === 1 ? 'ascending' : 'descending') : 'none');
    b.classList.toggle('is-sorted', on);
  }
}

function populateTypes() {
  const sel = $('filter-attack-type');
  for (const t of [...new Set(state.all.map((i) => i.attackType))].sort()) sel.append(el('option', { value: t, text: t }));
}

function resetFilters() {
  $('filter-date-start').value = '';
  $('filter-date-end').value = '';
  $('filter-attack-type').value = '';
  for (const s of SEVERITIES) $(`sev-${s}`).checked = true;
  for (const s of STATUSES) $(`status-${s}`).checked = true;
  render();
}

function exportNavigator() {
  const layer = navigatorLayer(state.filtered, { name: `Incident techniques (${state.filtered.length} incidents)` });
  $('export-out').value = JSON.stringify(layer, null, 2);
  $('export-label').textContent = `ATT&CK Navigator layer — ${layer.techniques.length} techniques scored by incident count. Paste into attack.mitre.org's Navigator → Open Existing Layer → Upload from local.`;
}
function exportStix() {
  const bundle = toStixBundle(state.filtered, state.mapping);
  $('export-out').value = JSON.stringify(bundle, null, 2);
  $('export-label').textContent = `STIX 2.1 bundle — ${bundle.objects.length} objects (incident, attack-pattern, relationship).`;
}
async function importStix(file) {
  try {
    const r = fromStixBundle(JSON.parse(await file.text()));
    if (r.incidents.length === 0) throw new Error(`no importable incidents (${r.skipped.length} skipped)`);
    state.all = r.incidents;
    state.source = `${file.name} (STIX 2.1: ${r.incidents.length} incidents from ${r.objects} objects${r.skipped.length ? `, ${r.skipped.length} skipped` : ''})`;
    $('filter-attack-type').replaceChildren(el('option', { value: '', text: 'All types' }));
    populateTypes();
    setText('import-note', r.skipped.length ? r.skipped.map((s) => `${s.id}: ${s.error}`).join(' · ') : `Imported ${r.incidents.length} incidents.`);
    resetFilters();
  } catch (err) {
    setText('import-note', `Import failed: ${err.message}`);
  }
}

async function boot() {
  const Chart = await loadChartLib();
  charts = makeCharts(Chart);
  if (!Chart) $('chart-notice').hidden = false;
  const [rows, mapping] = await Promise.all([fetch('data/incidents.json').then((r) => r.json()), fetch('data/mitre-mapping.json').then((r) => r.json())]);
  const loaded = loadIncidents(rows);
  state.all = loaded.incidents;
  state.mapping = mapping;
  if (loaded.rejected.length) setText('import-note', `${loaded.rejected.length} shipped records rejected: ${loaded.rejected.map((r) => `#${r.index} ${r.error}`).join(' · ')}`);
  populateTypes();
  for (const id of ['filter-date-start', 'filter-date-end', 'filter-attack-type']) $(id).addEventListener('change', render);
  for (const s of [...SEVERITIES.map((x) => `sev-${x}`), ...STATUSES.map((x) => `status-${x}`)]) $(s).addEventListener('change', render);
  $('btn-reset-filters').addEventListener('click', resetFilters);
  for (const b of document.querySelectorAll('button[data-col]')) {
    b.addEventListener('click', () => {
      const col = b.dataset.col;
      state.sort = state.sort.col === col ? { col, dir: -state.sort.dir } : { col, dir: col === 'time' ? -1 : 1 };
      renderTable();
    });
  }
  $('btn-navigator').addEventListener('click', exportNavigator);
  $('btn-stix').addEventListener('click', exportStix);
  $('stix-file').addEventListener('change', (e) => e.target.files[0] && importStix(e.target.files[0]));
  render();

  shell = mountExecShell({
    title: 'Cybersecurity Incident Dashboard',
    tagline: 'A year of incident records with severity, status and response time, mapped to MITRE ATT&CK techniques: filterable, sortable, exportable as an ATT&CK Navigator layer or a STIX 2.1 bundle, and importable from STIX. Synthetic data; no live monitoring.',
    repo: 'https://github.com/Freddricklogan/cybersecurity-incident-dashboard',
    pagesUrl: 'https://freddricklogan.github.io/cybersecurity-incident-dashboard/',
    badges: [{ label: 'ATT&CK heatmap', tone: 'accent' }, { label: 'Navigator layer export', dot: true }, { label: 'STIX 2.1 in/out', dot: true }, { label: 'Synthetic data', dot: true }],
    kpis: [
      { label: 'Incidents shown', compute: () => state.stats?.total ?? '—', tone: 'accent' },
      { label: 'Critical', compute: () => state.stats?.bySeverity.Critical ?? '—', tone: 'danger' },
      { label: 'Not resolved', compute: () => state.stats?.open ?? '—', tone: 'warn' },
      { label: 'Median response', compute: () => hoursLabel(state.stats?.medianResponseHours) },
      { label: 'Techniques hit', compute: () => (state.mapping ? heatmap(state.mapping, state.filtered).columns.flatMap((c) => c.techniques).filter((t) => t.count).length : '—'), tone: 'muted' }
    ],
    tour: [
      { selector: '#stat-cards', title: 'The numbers are counts, not a status light', body: 'Total, by severity, unresolved, and the median response time computed from the records. The old header said "System Active" next to a clock; nothing here claims to be monitoring anything.', action: () => resetFilters() },
      { selector: '#filters', title: 'Filter to the critical backlog', body: 'Critical severity, any status except Resolved. The charts, heatmap and table all follow the same filtered set.', action: () => { for (const s of SEVERITIES) $(`sev-${s}`).checked = s === 'Critical'; $('status-Resolved').checked = false; render(); } },
      { selector: '#mitre-section', title: 'ATT&CK heatmap', body: 'Techniques grouped by tactic in ATT&CK order, shaded by incident count within the current filter. Every technique in the data is checked against the mapping in tests.', action: () => resetFilters() },
      { selector: '#export', title: 'Export a Navigator layer', body: 'A layer-format 4.5 document scored by incident count, ready for the ATT&CK Navigator — the format is checked field by field in tests.', action: () => exportNavigator() },
      { selector: '#export', title: 'Or a STIX 2.1 bundle', body: 'Incident SDOs linked by "uses" relationships to attack-pattern SDOs with MITRE external references. The importer reads the same bundle back; a test round-trips all 53 records.', action: () => exportStix() }
    ]
  });
  shell.refreshKpis();
}

boot();
