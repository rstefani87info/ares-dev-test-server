# Completion Plan @ares/dev-test-server
> Updated: 2026-08-21

## Current Status

- package.json: ESM package with `exports`, bin `ares-dev-test-server`, deps `@ares/web` (Express) + `@ares/web-socket` (ws)
- CLI: available as `ares-dev-test-server start [--port] [--ws-port]`
- test script: smoke `healthCheck` + `GET /api/projects`
- docs: main EN/IT docs complete (not placeholder)
- scope: Express runtime API + WebSocket, CRUD 6 maintenance entities, hybrid Strategy-C job runner, WS job event broadcast
- datasource: MySQL `maintenance_db` 6 tables (projects/tasks/job_definitions/job_runs/artifacts/logs), degraded mode 503 if DB down

## Completed In Phase 4

- Implemented Express boot with `aReS.include(webModule)` and WebSocket with `aReS.include({ aReSInitialize: initWebSocket })`
- Exposed CRUD REST endpoints: `/api/projects`, `/api/tasks`, `/api/job-definitions`, `/api/job-runs`, `/api/artifacts`, `/api/logs`
- Implemented `POST /api/jobs/execute` with hybrid Strategy-C runner:
  - `JOBS_FAST_SET` (scd:git-status, core-dev:datasource:list) → in-process execution
  - long jobs → `child_process.spawn('node cli … --json')` with polling + WS shortcut
- Standard `JobOutput` shape (logs, artifacts, result, error, status, duration, projectRoot)
- WS broadcast events: `job:started`, `job:done`, `job:failed`
- Health `/health`, static `/artifacts` and `/logs` for direct persisted output access
- Updated IT/EN docs with endpoints, env config, troubleshooting

## Remaining Work

### High Priority

- Validate local MySQL connection `maintenance_db` and table creation via auto migration
- Run end-to-end smoke: start server → POST job → receive WS event
- Implement basic rate limiting / authentication on endpoints (JWT from `@ares/web`)

### Medium Priority

- Establish OpenAPI/Swagger auto-generated API contract schema
- Expand `JOBS_FAST_SET` with other frequent commands (scd:build, core-dev:datasource:add?)
- Implement file-based fallback persistence when DB is in degraded mode

### Low Priority

- Add metrics/prometheus endpoint
- Decide TypeScript declarations for API client
- Add cross-references: `@ares/scd`, `@ares/file-sync`

## References

- Main doc IT: ./dev-test-server.md
- Main doc EN: ../en/dev-test-server.md
- API runtime contract ticket: ../tickets/20260819-phase4-api-runtime-contract.md
- Maintenance datasource: ../../ecosystem/datasources/maintenance/
