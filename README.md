# Cybersecurity Incident Response Dashboard

An interactive, browser-based dashboard for visualizing and analyzing cybersecurity incidents with MITRE ATT&CK framework mapping. Built for security operations teams to monitor, filter, and respond to security events in real time.

## Live Demo

[View Dashboard](https://freddricklogan.github.io/cybersecurity-incident-dashboard/)

## Features

- **Real-Time Overview** -- Summary stat cards showing total incidents by severity level
- **Severity Distribution** -- Interactive donut chart breaking down incident severity
- **Incident Timeline** -- Line chart showing incident trends over time by severity
- **MITRE ATT&CK Heatmap** -- Visual mapping of incidents to ATT&CK techniques and tactics with color-coded intensity
- **Filterable Incident Log** -- Sortable table with date range, severity, and attack type filters
- **Live Clock** -- Real-time system clock in the header
- **Responsive Design** -- Fully responsive layout for desktop and mobile
- **Dark Theme** -- Professional SOC-style dark interface

## Tech Stack

| Technology | Purpose |
|:-----------|:--------|
| HTML5 / CSS3 | Structure and styling |
| JavaScript (ES6+) | Application logic |
| Chart.js | Donut and line chart rendering |
| MITRE ATT&CK | Threat framework mapping |

## Data Structure

### incidents.json
```json
{
    "id": 1,
    "timestamp": "2025-03-15T08:23:00Z",
    "title": "Spear Phishing Campaign",
    "severity": "Critical",
    "status": "Resolved",
    "attack_type": "Phishing",
    "mitre_technique": "T1566.001",
    "mitre_tactic": "Initial Access",
    "affected_systems": ["Email Gateway"],
    "response_time_hours": 2.5
}
```

### mitre-mapping.json
Maps MITRE ATT&CK technique IDs to names, tactics, and descriptions. Covers 35 techniques across 12 tactics.

## Getting Started

1. Clone the repository
2. Open `index.html` in a browser (or use a local server)
3. Use sidebar filters to explore the data

```bash
git clone https://github.com/Freddricklogan/cybersecurity-incident-dashboard.git
cd cybersecurity-incident-dashboard
python -m http.server 8000
# Open http://localhost:8000
```

## MITRE ATT&CK Framework

The dashboard maps incidents to the [MITRE ATT&CK](https://attack.mitre.org/) framework, covering:

- **12 Tactics**: Reconnaissance through Impact
- **35 Techniques**: Including sub-techniques for Phishing, Brute Force, and Supply Chain attacks
- **Heatmap Visualization**: Color intensity reflects incident frequency per technique

## License

MIT License

## Author

**Freddrick Logan**
- [GitHub](https://github.com/Freddricklogan)
- [LinkedIn](https://linkedin.com/in/freddricklogan)
