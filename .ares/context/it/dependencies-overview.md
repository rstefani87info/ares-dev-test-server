# Dipendenze aReS — `@ares/dev-test-server`

## Dipendenze runtime (da `package.json`)

| Modulo | Perché (uso reale) |
|---|---|
| `@ares/core` | Runtime aReS: `aReSInitialize`, `loadDatasource`, `isProduction`, `getConfig`; base dell'estensione `aReSInclude`. |
| `@ares/web` | Server HTTP: `@ares/web` fornisce `httpServer` ed esporta `aReSInitialize`, `createCorsMiddleware`, `createJsonBodyParserMiddleware`, `logWebServerAccessPoint`, `isProduction` (da `@ares/web/server.js`). |
| `@ares/web-socket` | Server WebSocket per lo streaming evento job (`aReSInitialize`, `logWebSocketServerAccessPoint`). |
| `@ares/datasource-files` | Caricamento e auto-install dello schema del datasource `maintenance` (via `aReS.loadDatasource` con `autoInstallSchema: true` e snapshot). |
| `@ares/datasource-mysql` | Driver MySQL/MariaDB per il datasource `maintenance` (`ares_maintenance`). |
| `@ares/scd` | Toolchain: runner dei job veloci (es. `scd:git-status`) e dei job lunghi tramite `@ares/scd/cli.js` (`scdCliMain`). |
| `@ares/core-dev` | Runner dei job di scope `core-dev` (es. `core-dev:datasource:list`) invocando `@ares/core-dev/index.js`. |
| `@ares/os` | Utilità di sistema/lingua del sistema aReS (dichiarato come dipendenza). |

Visual dep: `express` (HTTP) e `fs/path/child_process` nativi.

## Chi dipende da questo modulo

- **Nessun modulo** del monorepo dichiara `@ares/dev-test-server` come dipendenza diretta nei `package.json` esaminati (è un server "di punta" dell'ecosistema, consumato dalle applicazioni host).

## Note

- Il datasource `maintenance` (schema `ares_maintenance`) è ricercato in `ecosystem/datasources/maintenance/` o `datasources/maintenance/`.
- Il modulo orchestera l'ecosistema: dipende da quasi tutti i livelli (core, web, web-socket, datasource-files, datasource-mysql, scd, core-dev, os), il che lo rende un aggregatore/point d'ingresso per test e automazioni.
