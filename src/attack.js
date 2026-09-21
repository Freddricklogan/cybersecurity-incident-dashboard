/** ATT&CK: technique counts per tactic, and an ATT&CK Navigator layer (layer format 4.5) export. */

export function techniqueCounts(incidents) {
  const counts = new Map();
  for (const i of incidents) counts.set(i.technique, (counts.get(i.technique) ?? 0) + 1);
  return counts;
}

/** Techniques grouped by the mapping's tactic order, each with its incident count; techniques seen in incidents but missing from the mapping are reported. */
export function heatmap(mapping, incidents) {
  const counts = techniqueCounts(incidents);
  const max = Math.max(1, ...counts.values());
  const columns = mapping.tactics
    .map((tactic) => ({
      tactic,
      techniques: Object.entries(mapping.techniques)
        .filter(([, t]) => t.tactic === tactic)
        .map(([id, t]) => ({ id, name: t.name, description: t.description ?? '', count: counts.get(id) ?? 0, intensity: (counts.get(id) ?? 0) / max }))
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    }))
    .filter((c) => c.techniques.length > 0);
  const unmapped = [...counts.keys()].filter((id) => !mapping.techniques[id]);
  return { columns, unmapped, max };
}

/**
 * ATT&CK Navigator layer: one entry per technique with the incident count as
 * the score, so the layer colours by frequency when loaded into the Navigator.
 */
export function navigatorLayer(incidents, { name = 'Incident techniques', domain = 'enterprise-attack', attackVersion = '14', description = '' } = {}) {
  const counts = techniqueCounts(incidents);
  const max = Math.max(1, ...counts.values());
  return {
    name,
    versions: { attack: attackVersion, navigator: '4.9.1', layer: '4.5' },
    domain,
    description: description || `${incidents.length} incidents; score = incident count per technique`,
    sorting: 3,
    layout: { layout: 'side', aggregateFunction: 'sum', showID: true, showName: true },
    hideDisabled: false,
    techniques: [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([techniqueID, score]) => ({ techniqueID, score, comment: `${score} incident${score === 1 ? '' : 's'}`, enabled: true, showSubtechniques: techniqueID.includes('.') })),
    gradient: { colors: ['#8ec843ff', '#ffe766ff', '#ff6666ff'], minValue: 0, maxValue: max },
    legendItems: [],
    metadata: [],
    showTacticRowBackground: false,
    selectTechniquesAcrossTactics: true,
    selectSubtechniquesWithParent: false
  };
}
