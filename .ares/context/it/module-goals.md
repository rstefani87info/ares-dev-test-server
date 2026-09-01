# Obiettivi del modulo `@ares/dev-test-server`

## Introduzione

`@ares/dev-test-server` è il modulo **server di test e DevOps** del framework aReS. Serve a creare, testare e orchestrare applicazioni dell'ecosistema (target: web + automazioni). Fornisce un runtime orchestratore del dominio "application managing": HTTP API + WebSocket + persistenza su datasource `maintenance` + runner ibrido di job.

## Obiettivi principali

- Fornire un server HTTP (Express via `@ares/web`) con CORS, JSON body, healthcheck e static file.
- Fornire server WebSocket (via `@ares/web-socket`) per lo **streaming dello stato dei job**.
- Caricare un datasource `maintenance` (MySQL/MariaDB) per persistenza di projects/tasks/jobs/artifacts/logs.
- Offrire **endpoint REST CRUD** su 6 entità maintenance e orchestrazione job (`/api/jobs/execute`).
- Eseguire job tramite **runner ibrido**: veloci **in-process** vs lunghi **subprocess** con `--json`.

## Responsabilità

- `aReSInitialize(aReS, options)` — estensione runtime: inizializza web + websocket, configura storage (`storageRoot`, `artifacts`, `logs`), carica il datasource maintenance, monta CRUD e job runner.
- `cliMain` — avvio standalone del server.
- `buildRestCrud(app, prefix, getDb)` — REST per 6 entità (projects, tasks, job-definitions, job-runs, artifacts, logs).
- `createJobRunner` / `runJobFast` / `spawnSubprocess` / `mapJobNameToCliInvocation` — orchestrazione job (`scd:<cmd>`, `core-dev:<cmd>`).
- `loadMaintenanceDatasource` — carica il datasource maintenance con `autoInstallSchema`.
- Servizio di health (`/health`).
- Mount statici `/artifacts` e `/logs` dalla storage root.

## Endpoint principali

- `GET /health` (http/websocket/db/storage),
- `GET/POST /api/{projects,tasks,job-definitions,job-runs,artifacts,logs}` + `/:id` (GET/PATCH/DELETE),
- `GET /api/jobs`, `GET /api/jobs/running`, `GET /api/jobs/:id`, `POST /api/jobs/execute`,
- `WS` per eventi `job:started`/`job:done`/`job:failed`.

## Cosa il modulo NON fa

- **Non** è un web framework generale: si appoggia a `@ares/web`.
- **Non** implementa il frontend/React client (in roadmap).
- Le scritture CRUD (`POST/PATCH/DELETE`) sono **placeholder** che rispondono `202 Accepted` senza SQL strutturato (persistenza reale in fase successiva).
- **Non** gestisce migrazioni proprie: usa `@ares/datasource-files` per l'auto-install dello schema del datasource maintenance.
