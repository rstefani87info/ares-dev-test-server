# Piano di completamento @ares/dev-test-server
> Aggiornato: 2026-08-21

## Stato Attuale

- package.json: package ESM con `exports`, bin `ares-dev-test-server`, dipendenze `@ares/web` (Express) + `@ares/web-socket` (ws)
- CLI: disponibile come `ares-dev-test-server start [--port] [--ws-port]`
- test script: smoke `healthCheck` + `GET /api/projects`
- docs: documenti principali IT/EN completi (non placeholder)
- scope: runtime API Express + WebSocket, CRUD 6 entità maintenance, job runner ibrido Strategia C, broadcast WS eventi job
- datasource: MySQL `maintenance_db` 6 tabelle (projects/tasks/job_definitions/job_runs/artifacts/logs), modalità degradata 503 se DB assente

## Completato in Fase 4

- Implementato boot Express con `aReS.include(webModule)` e WebSocket con `aReS.include({ aReSInitialize: initWebSocket })`
- Esposti endpoint REST CRUD: `/api/projects`, `/api/tasks`, `/api/job-definitions`, `/api/job-runs`, `/api/artifacts`, `/api/logs`
- Implementato `POST /api/jobs/execute` con runner ibrido Strategia C:
  - `JOBS_FAST_SET` (scd:git-status, core-dev:datasource:list) → esecuzione in-process
  - job lunghi → `child_process.spawn('node cli … --json')` con polling + WS shortcut
- Shape standard `JobOutput` (logs, artifacts, result, error, status, durata, projectRoot)
- Broadcast WS eventi: `job:started`, `job:done`, `job:failed`
- Health `/health`, static `/artifacts` e `/logs` per accesso diretto a output persistiti
- Aggiornata documentazione IT/EN con endpoints, configurazione env, troubleshooting

## Lavoro residuo

### Alta Priorita

- Validare connessione MySQL locale `maintenance_db` e creazione tabella via migration auto
- Eseguire smoke end-to-end: start server → POST job → ricevere evento WS
- Implementare rate limiting / autenticazione base su endpoints (JWT da `@ares/web`)

### Media Priorita

- Stabilire schema contract API OpenAPI/Swagger auto-generato
- Espandere set `JOBS_FAST_SET` con altri comandi frequenti (scd:build, core-dev:datasource:add?)
- Implementare persistenza file-based fallback quando DB è in modalità degradata

### Bassa Priorita

- Aggiungere metriche/prometheus endpoint
- Decidere TypeScript declarations per client API
- Aggiungere cross-reference: `@ares/scd`, `@ares/file-sync`

## Riferimenti

- Documento principale IT: ./dev-test-server.md
- Documento principale EN: ../en/dev-test-server.md
- Ticket contratto API runtime: ../tickets/20260819-phase4-api-runtime-contract.md
- Datasource maintenance: ../../ecosystem/datasources/maintenance/
