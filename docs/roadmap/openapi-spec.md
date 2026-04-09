# 5C · OpenAPI Spec Generation

**Status:** 📋 Planned

## Scope

Generate OpenAPI 3.1 spec from Express routes. Serve Swagger UI at `/api/docs`.

## Approach

- Use `swagger-jsdoc` to generate spec from JSDoc annotations on route handlers
- Or: hand-write `openapi.yaml` and validate against routes with a test
- Serve via `swagger-ui-express` at `/api/docs`

## Spec Coverage

All 16 route groups: catalogs, mappings, implementations, coverage, governance, risk, intel, drift, assets, connectors, owners, audit, export, diff, watches, org, import.

## Files to Create

- `src/web/openapi.yaml` or `openapi.ts` (generated)
- Route in `server.ts` to serve Swagger UI

## Exit Criteria

- [ ] OpenAPI spec covers all endpoints with request/response schemas
- [ ] Swagger UI accessible at `/api/docs`
- [ ] Spec validates with `swagger-cli validate`
