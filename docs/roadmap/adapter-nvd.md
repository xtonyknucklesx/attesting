# 4B · NIST NVD Adapter

**Status:** 📋 Planned
**Pattern:** `src/services/connectors/adapters/cisa-kev.ts`

## Scope

Pull CVE records from NIST National Vulnerability Database. Transform to `threat_inputs`. Auto-correlate with existing provisional manual intel.

## Files to Create

- `src/services/connectors/adapters/nvd.ts`
- `tests/services/connectors/nvd.test.ts`

## Config

```json
{ "api_key": "..." }
```

API key is optional but increases rate limit from 5/30s to 50/30s.

## Transform Mapping

| NVD Field | → threat_inputs Column |
|-----------|----------------------|
| `cve.id` | `external_id`, included in `title` |
| `cve.descriptions[0].value` | `description` |
| `cve.metrics.cvssMetricV31[0].cvssData.baseScore` | `severity` (mapped to 1-5) |
| `cve.configurations[].nodes[].cpeMatch[].criteria` | `platform` (extracted) |
| `cve.published` | `published_at` |

## Key Details

- `fetch(since)` uses `/cves/2.0?lastModStartDate=...&lastModEndDate=...`
- Paginate with `startIndex` + `resultsPerPage` (max 2000)
- After sync, run `checkAutoCorroboration()` to match against provisional intel
- CVSS score → severity: 0-3.9=low, 4-6.9=medium, 7-8.9=high, 9-10=critical

## Exit Criteria

- [ ] Adapter transforms NVD records to threat_inputs
- [ ] Auto-corroboration fires after sync
- [ ] Rate limiting respected (with and without API key)
- [ ] Tests cover transform + CVSS mapping
