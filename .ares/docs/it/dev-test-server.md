# Documentazione @ares/dev-test-server

## Scopo

Modulo server per test e automazioni DevOps nell'ecosistema aReS. Orchestratore runtime del dominio "application managing": combina HTTP API (Express via `@ares/web`), WebSocket events (`@ares/web-socket`, driver `ws`), CRUD 6 entità maintenance e runner ibrido job.

## Installazione

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

### Avvio standalone

```bash
ares-dev-test-server --help
ares-dev-test-server start --port 3000 --ws-port 3001 --storage-root ./tmp/dev-test-server
```

### Come estensione runtime in app aReS

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

## CLI pubbliche

| Comando | Parametri | Scopo |
|---|---|---|
| `start` | `--port` (default 3000), `--ws-port` (3001), `--storage-root` (default `./tmp/dev-test-server`) | Avvia Express + WS listener, mount statici, CRUD API, runner ibrido |
| `--help` | - | Elenca comandi e flag |

> Nota: `@ares/web-socket` **non esporta `export default`**. L'include in `index.js` usa `{ aReSInitialize: initWebSocket }` per evitare il crash di runtime.

## Endpoint disponibili

| Method | URL | Descrizione |
|---|---|---|
| `GET` | `/health` | Stato server (http/websocket/db, paths storage, mount pubblici) → `{ status:"ok" | "degraded", ... }` |
| `GET` | `/artifacts/*` | Static file → `{storageRoot}/artifacts/` |
| `GET` | `/logs/*` | Static file → `{storageRoot}/logs/` |
| `WS`  | `ws://localhost:{wsPort}` | Streaming eventi job |
| | **REST CRUD 6 entità** (sotto `/api`) | |
| `GET`    | `/api/projects` | Elenco progetti (LIMIT 500) |
| `POST`   | `/api/projects` | Inserimento (ritorna 202 Accepted) |
| `GET`    | `/api/projects/:id` | Singolo progetto |
| `PATCH`  | `/api/projects/:id` | Modifica (202) |
| `DELETE` | `/api/projects/:id` | Cancellazione (202) |
|  | Pattern identico per | `/api/tasks`, `/api/job-definitions`, `/api/job-runs`, `/api/artifacts`, `/api/logs` |
| | **Orchestrazione job** | |
| `GET`  | `/api/jobs` | Tutti i job run recenti ordinati per data |
| `GET`  | `/api/jobs/running` | Solo job `RUNNING` |
| `GET`  | `/api/jobs/:id` | Dettaglio singolo run |
| `POST` | `/api/jobs/execute` | Lancia un job (vedi sotto) |

**Stato stato scritture**: `POST / PATCH / DELETE` sulle 6 entità ritornano 202 Accepted (placeholder). La scrittura SQL strutturata sarà introdotta in una fase successiva; il `GET` è già operativo via `SELECT * FROM ...`.

## Job Runner ibrido (Strategia C confermata)

Formato body `POST /api/jobs/execute`:

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

**Convenzione naming `<scope>:<comando>[:<sottocomando>]`**:
- Scope `scd`: `scd:build`, `scd:deploy`, `scd:git-status`, `scd:test`, `scd:git-flow-start`, `scd:git-flow-finish`
- Scope `core-dev`: `core-dev:project:init`, `core-dev:datasource:add`, `core-dev:datasource:list`, `core-dev:migration:run`, `core-dev:mapper:create`, `core-dev:test`

**Modalità ibrida**:
- **In-process (sincrona, 200/500)**: task veloci. Set attuale: `scd:git-status`, `core-dev:datasource:list`.
- **Subprocess fire-and-forget (202 Accepted)**: tutti gli altri job lunghi (build, migrate, deploy, test…). Il server spawna `node <cli> … --json`, parsa il JSON finale e salva l'esito nel registro + DB.

## Streaming stato via WebSocket

Eventi broadcastati JSON:

| Evento type | Payload | Trigger |
|---|---|---|
| `job:started` | `{ id, job_name, status:"RUNNING", project_root, started_at, pid, execution_mode, ... }` | Job accettato e partito |
| `job:done`    | stesso record + `status:"DONE"`, `completed_at`, `duration_ms`, `result` | Completamento ok |
| `job:failed`  | stesso record + `status:"FAILED"`, campo `error` serializzato | Errore runtime / exit code != 0 |

Registro run mantenuto in memoria (limit a N recenti) + futura scrittura tabella `job_runs` per persistenza.

## Datasource di manutenzione (MySQL/MariaDB) — note operative

- **Percorso canonico**: `../../ecosystem/datasources/maintenance/` oppure `./datasources/maintenance/` come fallback.
- **Connessione**: chiave ambiente `maintenance_db` (sia test sia production nel `datasource.js`).
- **Schema**: `ares_maintenance` con 6 tabelle (projects, tasks, job_definitions, job_runs, artifacts, logs).
- **Auto install**: `autoInstallSchema: true` di default nel `loadDatasource` interno.
- **Modalità degradata**: se `ares_maintenance` non è raggiungibile, il server continua a funzionare. Endpoint `/api/projects` ecc. → **503**, `/health` → `"status":"degraded"` + `"datasourceMaintenance":false`.

## Configurazione (appSetup / config)

Chiavi consumate da `config`:

```js
{
  webServerPort: 3000,
  devServer: {
    storageRoot: "./tmp/dev-test-server",   // mount /artifacts e /logs
    cors: true,
    wsPort: 3001,
    maxRecentRuns: 500,
    fastJobSet: ["scd:git-status", "core-dev:datasource:list"],
  },
  logging: { diagnostics: false }
}
```

## Test

```bash
yarn workspace @ares/dev-test-server test
ares-dev-test-server --help
```

## Errori comuni / Troubleshooting

| Problema | Causa probabile | Soluzione |
|---|---|---|
| `/health` → `status:"degraded"` + `datasourceMaintenance:false` | DB `ares_maintenance` non connesso | Verifica host/credenziali in `ecosystem/datasources/maintenance/datasource.js` |
| Endpoint `/api/projects` → 503 | Come sopra | Usa WS events e `/api/jobs` che non richiedono il DB |
| `POST /api/jobs/execute` → 400 `"jobName is required"` | Body invalido | Verifica JSON `{ jobName:"scd:build", args:[], projectRoot:"..." }` |
| WS non si connette su porta diversa | `--ws-port` mancante | Passa `--ws-port` esplicito o config `devServer.wsPort` |

## Note

- Vedi Note Operative Fasi 4 nel report `../../application-managing-report.md` per checklist end-to-end Fasi 1–5.
- Il React client dedicato è in roadmap (vedi task `./tasks/`).
