![CI](https://github.com/xtonyknucklesx/crosswalk/actions/workflows/ci.yml/badge.svg)

# Crosswalk

OSCAL-native compliance control platform. Write your control implementations once, map them across every framework, and export to any format.

## The Problem

Every compliance team answers the same security questions dozens of different ways across different frameworks. SIG asks "Do you have an access control policy?" ISO 27001 asks the same thing with different words. NIST 800-171 asks it again. CMMC asks it again. Each time, someone re-answers from scratch or copy-pastes from a spreadsheet and hopes nothing drifted.

The tooling makes it worse. The industry-standard SIG Manager is a macro-enabled Excel workbook. ISO 27001 SOAs live in spreadsheets. CMMC self-assessments are spreadsheets. There's no single source of truth, no cross-framework mapping, and no way to write an answer once and have it resolve everywhere.

## What Crosswalk Does

Crosswalk replaces spreadsheet-based compliance workflows with an OSCAL-native data model:

1. **Import** control catalogs from any framework (NIST 800-171, ISO 27001, SIG, CMMC, NISPOM, or custom)
2. **Map** controls across frameworks (SIG question A.1 ↔ ISO 27001 A.5.1 ↔ NIST 800-171 3.1.1)
3. **Implement** — write each control implementation once, tag it to a control, and let mappings resolve the rest
4. **Export** in any format: SIG-compatible questionnaires, ISO 27001 SOA workbooks, CMMC self-assessments, OSCAL JSON, or PDF reports
5. **Assess** — track compliance status, findings, evidence, and POA&M items per control

## Architecture

- **CLI-first** — scriptable, composable, CI/CD-ready
- **SQLite backend** — local-first, single file, no server dependencies
- **OSCAL-native** — data model aligns with NIST OSCAL 1.1.2
- **Framework-agnostic** — any control catalog, any mapping, any export format
- **TypeScript/Node** — single language across CLI, importers, exporters

## Quick Start

```bash
# Install
git clone https://github.com/arossi3/crosswalk.git
cd crosswalk
npm install
npm run build

# Initialize your organization
crosswalk org init --name "My Company"
crosswalk scope create --name "My Product" --type product

# Import frameworks
crosswalk catalog import --format oscal --file data/catalogs/nist-800-171-r2.json \
  --name "NIST 800-171" --short-name nist-800-171-r2

crosswalk catalog import --format sig --file path/to/your/SIG_Manager_2026.xlsm \
  --scope-level lite --name "SIG Lite 2026" --short-name sig-lite-2026

# Import cross-framework mappings
crosswalk mapping import --format csv --file data/mappings/sig-to-nist800171.csv \
  --source-catalog sig-lite-2026 --target-catalog nist-800-171-r2

# Add an implementation
crosswalk impl add \
  --control sig-lite-2026:A.1 \
  --scope "My Product" \
  --status implemented \
  --response Yes \
  --statement "We maintain a formalized risk governance policy approved by the board."

# See what that one implementation covers across frameworks
crosswalk mapping resolve sig-lite-2026:A.1

# Check coverage
crosswalk impl status --scope "My Product"

# Export as SIG Response SIG
crosswalk export sig --catalog sig-lite-2026 --scope "My Product" \
  --format response-sig --output my-sig-response.xlsm

# Export as OSCAL
crosswalk export oscal --type component-definition --scope "My Product" \
  --output my-component.json
```

## Data Model

Four layers, all stored in a single SQLite database:

| Layer | What It Stores | Example |
|-------|---------------|---------|
| **Catalogs** | Controls from any framework | NIST 800-171 has 110 controls, SIG Lite has 135 questions |
| **Mappings** | Cross-framework control relationships | SIG A.1 ↔ ISO 27001 A.5.1 (equivalent, high confidence) |
| **Implementations** | How your org satisfies each control | "We enforce MFA via Okta with 12-hour session timeout" |
| **Assessments** | Compliance status, findings, evidence, POA&M | Control 3.1.1: satisfied, evidence: MFA config screenshot |

The key insight: **implementations resolve across frameworks through mappings.** Write one implementation for a SIG control, and if that SIG control maps to equivalent NIST, ISO, and CMMC controls, your coverage updates automatically across all of them.

## Supported Frameworks

| Framework | Import Format | Status |
|-----------|--------------|--------|
| NIST SP 800-171 Rev 2 | OSCAL JSON (NIST-published) | Planned |
| NIST SP 800-53 Rev 5 | OSCAL JSON (NIST-published) | Planned |
| SIG Lite / Core / Detail 2026 | SIG Manager .xlsm | Planned |
| ISO/IEC 27001:2022 | CSV | Planned |
| CMMC 2.0 Level 2 | CSV | Planned |
| NISPOM 32 CFR 117 | CSV | Planned |
| Any custom framework | CSV with configurable columns | Planned |

## Export Formats

| Format | Use Case |
|--------|----------|
| SIG Response SIG (.xlsm) | Send pre-answered questionnaire to customers |
| SIG Questionnaire (.xlsm) | Send blank questionnaire to vendors |
| OSCAL JSON | Machine-readable compliance data (component-definition, SSP, assessment-results, POA&M) |
| ISO 27001 SOA (.xlsx) | Statement of Applicability for ISMS certification |
| CMMC Self-Assessment (.xlsx) | CMMC Level 2 self-assessment workbook |
| PDF Report | Human-readable compliance summary |
| CSV | Flat export for analysis, Jira import, or other tools |

## Important: Copyrighted Content

Crosswalk does **not** ship copyrighted framework content (e.g., SIG question text, ISO 27001 control text). The tool imports control text from your own licensed copies of these frameworks. Seed data in this repository contains only structural metadata (control IDs, risk domains, control families, mapping references) without proprietary question or requirement text.

## Project Status

🚧 **Early development** — not yet functional. See [CROSSWALK_SPEC.md](docs/CROSSWALK_SPEC.md) for the full technical specification.

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE).
