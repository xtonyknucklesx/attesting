![CI](https://github.com/xtonyknucklesx/crosswalk/actions/workflows/ci.yml/badge.svg)

# Crosswalk

Open-source, OSCAL-native GRC platform. Map controls across frameworks, manage risk with live threat intelligence, and detect compliance drift — all from a single source of truth.

## The Problem

Compliance teams answer the same security questions across dozens of frameworks using disconnected spreadsheets. Risk registers live in one tool, policies in another, evidence in a shared drive, threat intel in an email thread. When a policy changes, nobody knows which controls are affected. When a new CVE drops, nobody knows which assets are exposed or which risk scores need updating. When an auditor asks for evidence, everyone scrambles.

The industry-standard tooling — SIG Manager in Excel, SOAs in spreadsheets, risk registers in SharePoint — makes this worse. There's no single source of truth, no cross-module propagation, and no way for a change in one area to automatically surface its impact everywhere else.

## What Crosswalk Does

Crosswalk treats governance, risk, and compliance as a connected graph, not three separate tabs.

**Compliance engine** — Import control catalogs from any framework. Map controls across frameworks so one implementation statement resolves everywhere. Export in any format: SIG questionnaires, OSCAL JSON, ISO SOAs, PDF reports, CSV.

**Governance module** — Track policies with granular section-level drift detection. When a policy section changes, every control implementation referencing it gets flagged automatically. Manage committees, meeting minutes, and role assignments.

**Risk management** — Maintain a risk register with a configurable 5×5 matrix. Link risks to controls and assets. Residual scores recalculate automatically when control effectiveness changes. Risk exceptions with expiry tracking.

**Threat intelligence** — Ingest feeds from CISA KEV, STIX/TAXII, NVD, and sector ISACs. Threats auto-correlate against your asset inventory by platform and propagate through the risk module. Manual intel enters as provisional, runs a shadow impact analysis showing what *would* change if confirmed, and promotes to a full threat when corroborated.

**Asset inventory** — Track systems, endpoints, applications, and services with platform metadata, data classification, and boundary assignment. Assets link to risks, threats, and control implementations for full scope visibility.

**Drift detection** — A background engine monitors the entire graph for misalignment: stale policy references, expired evidence, risk threshold breaches, expiring exceptions, connector failures. Analysts respond to drift alerts using natural language, and dispositions route through a supervisor approval workflow.

**Integration layer** — Connector adapter framework for external systems. CISA KEV adapter ships built-in. Architecture supports SIEM, CMDB, ticketing, identity, SBOM, vulnerability scanner, and cloud provider connectors. Every sync is logged and health-checked.

## Architecture

```
External Intel ──→ Risk Module ──→ Governance
  (CISA, STIX,      (hub)          (policies, sections)
   NVD, ISACs)         │
                       ├──→ Compliance
                       │    (controls, evidence, mappings)
                       │
                       └──→ Asset Inventory
                            (systems, platforms, boundaries)

       Drift Engine watches all modules for misalignment
```

- **CLI-first** — scriptable, CI/CD-ready, 23+ commands
- **Web UI** — React/Tailwind dashboard with dark mode
- **SQLite backend** — local-first, single file, zero config
- **OSCAL-native** — data model aligns with NIST OSCAL 1.1.2
- **TypeScript** — single language across CLI, API, importers, exporters
- **Migration system** — numbered SQL migrations applied automatically

## Quick Start

```bash
git clone https://github.com/xtonyknucklesx/crosswalk.git
cd crosswalk
npm install
npm run build

# Initialize your organization
crosswalk org init --name "My Company"
crosswalk scope create --name "My Product" --type product

# Import frameworks
crosswalk catalog import --format oscal \
  --file data/catalogs/nist-800-53-r5.json \
  --name "NIST 800-53" --short-name nist-800-53-r5

crosswalk catalog import --format sig \
  --file path/to/SIG_Manager_2026.xlsm \
  --scope-level lite --name "SIG Lite 2026" --short-name sig-lite-2026

# Import cross-framework mappings
crosswalk mapping import --format csv \
  --file data/mappings/sig-to-nist800171.csv \
  --source-catalog sig-lite-2026 --target-catalog nist-800-171-r3

# Add an implementation (resolves across all mapped frameworks)
crosswalk impl add \
  --control sig-lite-2026:A.1 \
  --scope "My Product" \
  --status implemented \
  --response Yes \
  --statement "We maintain a formalized risk governance policy approved by the board."

# Check what that implementation covers
crosswalk mapping resolve sig-lite-2026:A.1

# Check coverage across all frameworks
crosswalk impl status --scope "My Product"

# Export
crosswalk export sig --catalog sig-lite-2026 --scope "My Product" \
  --format response-sig --output my-sig-response.xlsm
crosswalk export oscal --type component-definition --scope "My Product" \
  --output my-component.json

# Start the web UI
crosswalk serve --port 3000
```

## Bundled Catalogs

Crosswalk ships with 14 catalogs covering 3,206 controls:

| Framework | Controls | Source Format |
|-----------|----------|---------------|
| NIST SP 800-53 Rev 5 | 1,189 | OSCAL JSON |
| NIST SP 800-171 Rev 3 | 110 | OSCAL JSON |
| NIST CSF 2.0 | 106 | OSCAL JSON |
| NIST SP 800-218 (SSDF) | 43 | OSCAL JSON |
| NIST 800-53 Baselines (×4) | varies | OSCAL JSON |
| SIG Lite 2026 | 135 | SIG .xlsm |
| ISO/IEC 27001:2022 | 93+22 | CSV |
| CMMC 2.0 Level 2 | 110 | CSV |
| NISPOM 32 CFR 117 | varies | CSV |
| GDPR | varies | CSV |
| EU AI Act | varies | CSV |
| CCPA/CPRA | varies | CSV |
| HIPAA Security Rule | varies | CSV |
| SOC 2 TSC | varies | CSV |
| PCI DSS 4.0 | varies | CSV |

282 cross-framework mappings ship pre-resolved with zero unresolved references.

## Data Model

Six interconnected layers, all in a single SQLite database:

| Layer | What It Stores |
|-------|---------------|
| **Catalogs & Controls** | Controls from any framework, with full-text search and OSCAL parameters |
| **Mappings** | Cross-framework control relationships (equivalent, subset, superset, related) |
| **Implementations** | How your org satisfies each control — write once, resolve everywhere |
| **Governance** | Policies with section-level hashing, committees, role assignments |
| **Risk** | Risk register, matrix, exceptions, control linkage, asset exposure |
| **Threat Intel** | Ingested feeds, manual intel with shadow impact, asset correlations |

Supporting infrastructure: asset inventory, drift alerts, dispositions with NLP classification and approval workflow, integration connectors, and a full audit log.

## API

The Express API exposes endpoints for all modules:

| Endpoint | Module |
|----------|--------|
| `/api/catalogs` | Framework catalogs and controls |
| `/api/mappings` | Cross-framework control mappings |
| `/api/implementations` | Implementation statements |
| `/api/coverage` | Coverage calculations |
| `/api/governance` | Policies, committees, roles |
| `/api/risk` | Risk register, matrix, exceptions |
| `/api/intel` | Threat inputs and manual intel |
| `/api/drift` | Drift alerts and dispositions |
| `/api/assets` | Asset inventory |
| `/api/connectors` | Integration connector management |
| `/api/owners` | People and role assignments |
| `/api/audit` | Immutable audit trail |
| `/api/export` | OSCAL, SIG, CSV, PDF, SOA exports |
| `/api/diff` | Framework catalog change detection |

## Export Formats

| Format | Use Case |
|--------|----------|
| SIG Response (.xlsm) | Pre-answered questionnaire for customers |
| OSCAL JSON | Machine-readable (component-definition, SSP, assessment-results, POA&M) |
| ISO 27001 SOA (.xlsx) | Statement of Applicability |
| PDF Report | Human-readable compliance summary |
| CSV | Flat export for Jira, analysis, or other tools |

## Important: Copyrighted Content

Crosswalk does **not** ship copyrighted framework content (e.g., SIG question text, ISO 27001 control text). The tool imports control text from your own licensed copies. Seed data contains only structural metadata (control IDs, risk domains, mapping references) without proprietary content.

## Docker

```bash
docker compose up -d
# Crosswalk available at http://localhost:3000
```

Data persists in a Docker volume (`crosswalk-data`).

## Project Status

Active development. Core platform complete:

- **Phase 1** ✅ CLI parity — 22+ commands across risk, intel, drift, connector groups
- **Phase 2** ✅ Web UI — assets, intel, drift, connectors pages
- **Phase 3** ✅ Test coverage — 288 tests across 44 files
- **Phase 4** (partial) ✅ NVD adapter, SBOM ingestion (CycloneDX + SPDX)
- **Phase 5** ✅ Docker, CI/CD, changelog, security policy
- **Phase 6** ✅ Proprietary catalog import with file security scanning

See [docs/roadmap/ROADMAP.md](docs/roadmap/ROADMAP.md) for the full roadmap.

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, architecture guidelines, and what needs help.

## License

MIT — see [LICENSE](LICENSE).