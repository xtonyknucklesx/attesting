# Contributing to Crosswalk

Thanks for your interest in contributing. This project is in early development and contributions are welcome.

## How to Contribute

1. **Fork** the repository
2. **Create a branch** for your feature or fix (`git checkout -b feature/my-feature`)
3. **Write tests** for any new functionality
4. **Run tests** before submitting (`npm test`)
5. **Submit a PR** with a clear description of what changed and why

## Development Setup

```bash
git clone https://github.com/YOUR-USERNAME/crosswalk.git
cd crosswalk
npm install
npm test
```

## What We Need Help With

- **Framework importers** — parsers for additional control frameworks (FedRAMP, PCI-DSS, SOC 2, HIPAA, etc.)
- **Mapping data** — verified cross-framework control mappings (especially mappings not already published by NIST or SIG)
- **Export formats** — additional output formats (FedRAMP SSP template, SOC 2 Type II report format, etc.)
- **Testing** — especially manual validation of export output against real framework tools
- **Documentation** — usage guides, tutorials, framework-specific walkthroughs

## Architecture Decisions

Before proposing significant architectural changes, please open an issue to discuss. The core design decisions (SQLite, CLI-first, OSCAL-native data model) are intentional and documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Code Standards

- TypeScript strict mode
- Tests for all importers, exporters, and mapping logic
- No copyrighted framework content in the repository (control IDs and structural metadata only)
- No organization-specific data in the repository

## Mapping Contributions

If you're contributing cross-framework mappings:

- Each mapping must specify a relationship type (equivalent, subset, superset, related, intersects)
- Each mapping must specify a confidence level (high, medium, low)
- Include a source (e.g., "SIG Content Library ISO 27001:2022 column", "NIST SP 800-53 to 800-171 mapping")
- Mappings should be verified by someone with domain expertise in both frameworks

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
