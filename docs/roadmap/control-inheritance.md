# 10A · Control Inheritance + Scoped Overlays

**Status:** 💡 Future

## Scope

Allow parent scopes to define baseline implementations that child scopes inherit. Children can overlay (override, supplement, or exclude) individual controls without duplicating the full set.

## Concept

```
Organization (baseline implementations)
  └── Scope: Cloud (inherits baseline + cloud-specific overlays)
       ├── Scope: AWS (inherits Cloud + AWS-specific)
       └── Scope: Azure (inherits Cloud + Azure-specific)
```

## Implementation

- **Migration:** Add `parent_scope_id` to `scopes`, `implementation_overlays` table (scope_id, implementation_id, overlay_type [inherit|override|exclude], override_json)
- **Service:** `src/services/inheritance/resolver.ts` — walks scope tree, merges implementations with overlays
- **API:** `GET /api/implementations?scope=aws` returns merged view (inherited + overlays)
- **UI:** Scope selector in implementations page, inherited items shown with badge, overlay editor

## Key Details

- Inheritance is read-time resolution, not data duplication
- Overlays are lightweight: only store the diff from parent
- Exclude removes a parent control from the child scope
- Override replaces implementation details (narrative, evidence, status)
- Coverage calculations respect the resolved set per scope

## Exit Criteria

- [ ] Child scope inherits parent implementations
- [ ] Overlays modify inherited controls correctly
- [ ] Coverage scores calculate against resolved set
