# 5E · Docker Packaging

**Status:** 📋 Planned

## Scope

Single-command deployment via Docker. Includes CLI, API server, and Web UI.

## Files to Create

- `Dockerfile` — multi-stage build (build stage + runtime stage)
- `docker-compose.yml` — single service with volume for database persistence
- `.dockerignore`

## Dockerfile Strategy

```
Stage 1 (build): node:20-alpine, npm ci, npm run build
Stage 2 (runtime): node:20-alpine, copy dist + node_modules, expose 3000
```

## Volume

- `~/.crosswalk/` mounted as volume for database persistence across restarts

## Environment Variables

- `CROSSWALK_PORT` (default 3000)
- `CROSSWALK_DB_PATH` (default `~/.crosswalk/crosswalk.db`)
- `CROSSWALK_LOG_LEVEL` (default `info`)

## Exit Criteria

- [ ] `docker build -t crosswalk .` succeeds
- [ ] `docker compose up` starts API + Web UI
- [ ] Database persists across container restarts
- [ ] Image size under 200MB
