let allIncidents = [];
let filteredIncidents = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initClock();
    initFilters();
});

async function loadData() {
    const res = await fetch('data/incidents.json');
    allIncidents = await res.json();
    filteredIncidents = [...allIncidents];
    renderAll();
}

function renderAll() {
    renderStatCards();
    renderSeverityChart();
    renderTimelineChart();
    renderTable();
    if (window.renderMitreHeatmap) window.renderMitreHeatmap(filteredIncidents);
}

/* Stat Cards */
function renderStatCards() {
    const counts = { total: filteredIncidents.length, Critical: 0, High: 0, Medium: 0, Low: 0 };
    filteredIncidents.forEach(i => counts[i.severity]++);

    document.getElementById('stat-total').textContent = counts.total;
    document.getElementById('stat-critical').textContent = counts.Critical;
    document.getElementById('stat-high').textContent = counts.High;
    document.getElementById('stat-medium').textContent = counts.Medium;
    document.getElementById('stat-low').textContent = counts.Low;
}

/* Severity Donut Chart */
function renderSeverityChart() {
    const ctx = document.getElementById('severityChart');
    if (!ctx) return;

    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    filteredIncidents.forEach(i => counts[i.severity]++);

    if (window.severityChartInstance) window.severityChartInstance.destroy();

    window.severityChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#cf5c4e', '#d9a441', '#d9a441', '#2fbf5f'],
                borderColor: '#0b100b',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#7f9585', padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } }
                }
            }
        }
    });
}

/* Timeline Chart */
function renderTimelineChart() {
    const ctx = document.getElementById('timelineChart');
    if (!ctx) return;

    const monthly = {};
    filteredIncidents.forEach(inc => {
        const d = new Date(inc.timestamp);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (!monthly[key]) monthly[key] = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        monthly[key][inc.severity]++;
    });

    const sortedKeys = Object.keys(monthly).sort();
    const labels = sortedKeys.map(k => {
        const [y, m] = k.split('-');
        return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    if (window.timelineChartInstance) window.timelineChartInstance.destroy();

    window.timelineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Critical', data: sortedKeys.map(k => monthly[k].Critical), borderColor: '#cf5c4e', backgroundColor: 'rgba(207, 92, 78,0.1)', fill: true, tension: 0.4 },
                { label: 'High', data: sortedKeys.map(k => monthly[k].High), borderColor: '#d9a441', backgroundColor: 'rgba(217, 164, 65,0.1)', fill: true, tension: 0.4 },
                { label: 'Medium', data: sortedKeys.map(k => monthly[k].Medium), borderColor: '#d9a441', backgroundColor: 'rgba(217, 164, 65,0.1)', fill: true, tension: 0.4 },
                { label: 'Low', data: sortedKeys.map(k => monthly[k].Low), borderColor: '#2fbf5f', backgroundColor: 'rgba(47, 191, 95,0.1)', fill: true, tension: 0.4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { color: 'rgba(11, 16, 11,0.5)' }, ticks: { color: '#7f9585', font: { size: 11 } } },
                y: { grid: { color: 'rgba(11, 16, 11,0.5)' }, ticks: { color: '#7f9585', stepSize: 1, font: { size: 11 } }, beginAtZero: true }
            },
            plugins: {
                legend: {
                    labels: { color: '#7f9585', usePointStyle: true, pointStyleWidth: 10, font: { size: 11 } }
                }
            }
        }
    });
}

/* Incident Table */
let sortCol = 'timestamp';
let sortDir = -1;

function renderTable() {
    const tbody = document.getElementById('incident-tbody');
    if (!tbody) return;

    const sorted = [...filteredIncidents].sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (sortCol === 'timestamp') { va = new Date(va); vb = new Date(vb); }
        if (sortCol === 'response_time_hours') { va = Number(va); vb = Number(vb); }
        if (va < vb) return -1 * sortDir;
        if (va > vb) return 1 * sortDir;
        return 0;
    });

    tbody.innerHTML = sorted.map(inc => {
        const date = new Date(inc.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const sevClass = inc.severity.toLowerCase();
        const statusClass = inc.status.toLowerCase();
        return `<tr>
            <td>${date}</td>
            <td>${inc.title}</td>
            <td><span class="severity-badge ${sevClass}">${inc.severity}</span></td>
            <td><span class="status-tag ${statusClass}">${inc.status}</span></td>
            <td>${inc.attack_type}</td>
            <td>${inc.mitre_technique}</td>
            <td>${inc.response_time_hours}h</td>
        </tr>`;
    }).join('');
}

function sortTable(col) {
    if (sortCol === col) {
        sortDir *= -1;
    } else {
        sortCol = col;
        sortDir = -1;
    }

    document.querySelectorAll('thead th').forEach(th => th.classList.remove('sorted'));
    const active = document.querySelector(`thead th[data-col="${col}"]`);
    if (active) active.classList.add('sorted');

    renderTable();
}

/* Filters */
function initFilters() {
    document.getElementById('filter-date-start')?.addEventListener('change', applyFilters);
    document.getElementById('filter-date-end')?.addEventListener('change', applyFilters);
    document.querySelectorAll('.severity-filter').forEach(cb => cb.addEventListener('change', applyFilters));
    document.getElementById('filter-attack-type')?.addEventListener('change', applyFilters);
    document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);

    populateAttackTypes();
}

function populateAttackTypes() {
    const select = document.getElementById('filter-attack-type');
    if (!select) return;
    const types = [...new Set(allIncidents.map(i => i.attack_type))].sort();
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        select.appendChild(opt);
    });
}

function applyFilters() {
    const startDate = document.getElementById('filter-date-start')?.value;
    const endDate = document.getElementById('filter-date-end')?.value;
    const attackType = document.getElementById('filter-attack-type')?.value;

    const checkedSeverities = [];
    document.querySelectorAll('.severity-filter:checked').forEach(cb => checkedSeverities.push(cb.value));

    filteredIncidents = allIncidents.filter(inc => {
        const incDate = new Date(inc.timestamp);
        if (startDate && incDate < new Date(startDate)) return false;
        if (endDate && incDate > new Date(endDate + 'T23:59:59Z')) return false;
        if (checkedSeverities.length && !checkedSeverities.includes(inc.severity)) return false;
        if (attackType && inc.attack_type !== attackType) return false;
        return true;
    });

    renderAll();
}

function resetFilters() {
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    document.getElementById('filter-attack-type').value = '';
    document.querySelectorAll('.severity-filter').forEach(cb => cb.checked = true);
    filteredIncidents = [...allIncidents];
    renderAll();
}

/* Clock */
function initClock() {
    const el = document.getElementById('live-clock');
    if (!el) return;
    function tick() {
        el.textContent = new Date().toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
    }
    tick();
    setInterval(tick, 1000);
}

/* Expose sortTable globally */
window.sortTable = sortTable;
