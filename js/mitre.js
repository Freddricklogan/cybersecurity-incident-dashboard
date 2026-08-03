let mitreData = null;

document.addEventListener('DOMContentLoaded', async () => {
    const res = await fetch('data/mitre-mapping.json');
    mitreData = await res.json();
});

window.renderMitreHeatmap = function(incidents) {
    if (!mitreData) return;

    const container = document.getElementById('mitre-grid');
    if (!container) return;

    // Count technique occurrences
    const techCounts = {};
    incidents.forEach(inc => {
        const t = inc.mitre_technique;
        techCounts[t] = (techCounts[t] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(techCounts), 1);

    // Group techniques by tactic
    const tacticMap = {};
    mitreData.tactics.forEach(t => { tacticMap[t] = []; });

    Object.entries(mitreData.techniques).forEach(([id, tech]) => {
        const tactic = tech.tactic;
        if (tacticMap[tactic]) {
            tacticMap[tactic].push({ id, ...tech, count: techCounts[id] || 0 });
        }
    });

    // Render
    container.innerHTML = '';

    mitreData.tactics.forEach(tactic => {
        const techniques = tacticMap[tactic];
        if (!techniques || techniques.length === 0) return;

        const col = document.createElement('div');
        col.className = 'mitre-column';

        const header = document.createElement('div');
        header.className = 'tactic-header';
        header.textContent = tactic;
        col.appendChild(header);

        techniques.sort((a, b) => b.count - a.count);

        techniques.forEach(tech => {
            const cell = document.createElement('div');
            cell.className = 'mitre-cell';

            const intensity = tech.count / maxCount;
            if (tech.count > 0) {
                const r = Math.round(239 * intensity + 26 * (1 - intensity));
                const g = Math.round(68 * intensity + 35 * (1 - intensity));
                const b = Math.round(68 * intensity + 50 * (1 - intensity));
                cell.style.background = `rgba(${r}, ${g}, ${b}, ${0.2 + intensity * 0.6})`;
                cell.style.color = '#cdefd6';
            } else {
                cell.style.background = 'rgba(11, 16, 11, 0.3)';
            }

            cell.innerHTML = `
                <span class="technique-id">${tech.id}</span>
                <span class="technique-name">${tech.name}</span>
                <div class="mitre-tooltip">
                    <strong>${tech.id}: ${tech.name}</strong>
                    ${tech.description}<br>
                    <span style="color: ${tech.count > 0 ? '#cf5c4e' : '#7f9585'}; font-weight: 600; margin-top: 4px; display: inline-block;">
                        ${tech.count} incident${tech.count !== 1 ? 's' : ''}
                    </span>
                </div>
            `;

            col.appendChild(cell);
        });

        container.appendChild(col);
    });
};
