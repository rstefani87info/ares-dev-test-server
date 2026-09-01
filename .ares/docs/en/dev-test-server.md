# @ares/dev-test-server Documentation

## Purpose

Server module for DevOps automation and testing inside the aReS ecosystem. Runtime orchestrator for the "application managing" domain: it combines HTTP APIs (Express via `@ares/web`), WebSocket events (`@ares/web-socket`, driver `ws`), 6-entity maintenance CRUD, and a hybrid job runner.

## Installation

```json
{
  "name": "@ares/dev-test-server",
  "type": "module",
  "bin": { "ares-dev-test-server": "./index.js" },
  "exports": { ".": "./index.js" },
  "dependencies": {
    "@ares/core": "workspace:^",
    "@ares/web": "workspace:^",
    "@ares/web-socket": "workspace:^",
    "@ares/scd": "workspace:^",
    "@ares/core-dev": "workspace:^"
  }
}
```

```bash
yarn add @ares/dev-test-server
yarn workspace <app> add @ares/dev-test-server
```

## Quickstart

### Standalone boot

```bash
ares-dev-test-server --help
ares-dev-test-server start --port 3000 --ws-port 3001 --storage-root ./tmp/dev-test-server
```

### As a runtime extension inside an aReS host app

```js
import aresCore from "@ares/core";
import devTestServer from "@ares/dev-test-server";

const aReS = await aresCore.aReSInitialize({
  name: "my-platform",
  environment: "test",
  environments: [{ type: "test", domain: "localhost" }],
  config: {
    webServerPort: 3000,
    logging: { diagnostics: false },
    devServer: { storageRoot: "./tmp/dev-test-server", cors: true },
  },
  policies: {},
});

await aReS.include(devTestServer);
```

## Public CLI

| Command | Params | Purpose |
|---|---|---|
| `start` | `--port` (default 3000), `--ws-port` (3001), `--storage-root` (default `./tmp/dev-test-server`) | Boots Express + WS listeners, static mounts, CRUD API, hybrid runner |
| `--help` | - | Lists commands and flags |

> Implementation note: `@ares/web-socket` does **NOT export a default**. The include inside `index.js` uses `{ aReSInitialize: initWebSocket }` to avoid a runtime crash.

## Available endpoints

| Method | URL | Description |
|---|---|---|
| `GET` | `/health` | Server state (http/websocket/db, storage paths, public mounts) → `{ status:"ok" | "degraded", ... }` |
| `GET` | `/artifacts/*` | Static files → `{storageRoot}/artifacts/` |
| `GET` | `/logs/*` | Static files → `{storageRoot}/logs/` |
| `WS`  | `ws://localhost:{wsPort}` | Job event streaming |
| | **REST CRUD 6 entities** (under `/api`) | |
| `GET`    | `/api/projects` | Project list (LIMIT 500) |
| `POST`   | `/api/projects` | Insert (returns 202 Accepted) |
| `GET`    | `/api/projects/:id` | Single project |
| `PATCH`  | `/api/projects/:id` | Update (202) |
| `DELETE` | `/api/projects/:id` | Delete (202) |
|  | Same pattern for | `/api/tasks`, `/api/job-definitions`, `/api/job-runs`, `/api/artifacts`, `/api/logs` |
| | **Job orchestration** | |
| `GET`  | `/api/jobs` | All recent job runs ordered by date |
| `GET`  | `/api/jobs/running` | Only `RUNNING` jobs |
| `GET`  | `/api/jobs/:id` | Single run detail |
| `POST` | `/api/jobs/execute` | Launch a job (see below) |

**Write-path status**: `POST / PATCH / DELETE` against the 6 entities return 202 Accepted (placeholder). Structured SQL writes will be introduced in a later phase; reads are fully operational via `SELECT * FROM ...`.

## Hybrid Job Runner (Strategy C confirmed)

`POST /api/jobs/execute` body shape:

```json
{
  "jobName": "scd:build",
  "args": [ "--type", "production" ],
  "projectRoot": "C:/progetti/my-app",
  "triggerBy": "api | ui | cli | cron",
  "jobDefinitionId": 123,
  "projectId": 42
}
```

**Naming convention `<scope>:<command>[:<subcommand>]`**:
- `scd` scope: `scd:build`, `scd:deploy`, `scd:git-status`, `scd:test`, `scd:git-flow-start`, `scd:git-flow-finish`
- `core-dev` scope: `core-dev:project:init`, `core-dev:datasource:add`, `core-dev:datasource:list`, `core-dev:migration:run`, `core-dev:mapper:create`, `core-dev:test`

**Hybrid modes**:
- **In-process (sync, 200/500)**: fast tasks. Current set: `scd:git-status`, `core-dev:datasource:list`.
- **Subprocess fire-and-forget (202 Accepted)**: every other long-running job (build, migrate, deploy, test…). Server spawns `node <cli> … --json`, parses final JSON and persists to registry + DB.

## WebSocket state streaming

Broadcasted JSON events:

| Event type | Payload | Trigger |
|---|---|---|
| `job:started` | `{ id, job_name, status:"RUNNING", project_root, started_at, pid, execution_mode, ... }` | Job accepted and started |
| `job:done`    | Same record + `status:"DONE"`, `completed_at`, `duration_ms`, `result` | Successful completion |
| `job:failed`  | Same record + `status:"FAILED"`, serialised `error` field | Runtime error or non-zero exit code |

Runs registry kept in memory (capped at N recent) + future write to `job_runs` table for durability.

## Maintenance datasource (MySQL/MariaDB)

- **Canonical path**: `../../ecosystem/datasources/maintenance/`, falling back to `./datasources/maintenance/`.
- **Connection key**: `maintenance_db` (both test and production environments in `datasource.js`).
- **Schema**: `ares_maintenance` with 6 tables (projects, tasks, job_definitions, job_runs, artifacts, logs).
- **Auto install**: `autoInstallSchema: true` by default in the internal `loadDatasource`.
- **Degraded mode**: if `ares_maintenance` is unreachable, server keeps running. `/api/projects` etc → **503**, `/health` → `"status":"degraded"` + `"datasourceMaintenance":false`.

## Configuration (appSetup / config)

Keys read from `config`:

```js
{
  webServerPort: 3000,
  devServer: {
    storageRoot: "./tmp/dev-test-server",   // /artifacts and /logs mounts
    cors: true,
    wsPort: 3001,
    maxRecentRuns: 500,
    fastJobSet: ["scd:git-status", "core-dev:datasource:list"],
  },
  logging: { diagnostics: false }
}
```

## Tests

```bash
yarn workspace @ares/dev-test-server test
ares-dev-test-server --help
```

## Common errors / Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `/health` → `status:"degraded"` + `datasourceMaintenance:false` | DB `ares_maintenance` not reachable | Verify host/credentials in `ecosystem/datasources/maintenance/datasource.js` |
| Endpoint `/api/projects` → 503 | Same as above | Use WS events + `/api/jobs` which don't need the DB |
| `POST /api/jobs/execute` → 400 `"jobName is required"` | Invalid body | Validate JSON `{ jobName:"scd:build", args:[], projectRoot:"..." }` |
| WS connects on wrong port | `--ws-port` missing | Pass explicit `--ws-port` or set `devServer.wsPort` |

## Notes

- See Phases 4 in `../../application-managing-report.md` for the end-to-end Phases 1–5 checklist.
- Dedicated React client is on roadmap (see `./tasks/`).
