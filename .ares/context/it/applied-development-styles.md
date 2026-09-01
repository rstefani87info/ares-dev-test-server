# Stile di sviluppo applicato — `@ares/dev-test-server`

## Standard di programmazione

- **JavaScript ESM** (`"type": "module"`), `bin` + `exports` espliciti in `package.json`.
- **Estensione runtime `aReS`**: il modulo espone un `aReSInitialize(aReS, options)` e un `export default { aReSInitialize }`, così può essere incluso via `aReS.include(...)`.
- **Composizione di moduli aReS**: `@ares/web` (Express + middleware `createCorsMiddleware`, `createJsonBodyParserMiddleware`), `@ares/web-socket` (incluso con `{ aReSInitialize: initWebSocket }` perché NON ha export default), `@ares/scd` (`scdCliMain`) e `@ares/core`.
- Sia bin eseguibile sia estensione: `index.js` è header `#!/usr/bin/env node` e avvia la CLI solo se eseguito direttamente (`import.meta.url === path.resolve(process.argv[1])`).
- Express come runtime HTTP effettivo (`express.json`, `express.static`).
- Pattern di risposta JSON uniformi: `sendJSON`, `sendError`.
- Naming: costanti SCREAMING_SNAKE (`JOBS_FAST_SET`, `IN_MEMORY` via `Symbol.for`), funzioni camelCase, costi di convenzione `scd:<cmd>` / `core-dev:<cmd>`.

## Contratto directory/file

```
dev-test-server/
├─ .ares/                # MANUALE  (contesto + docs obbligatorie; README del context)
├─ .git/                 # GENERATO (controllo versione)
├─ node_modules/         # GENERATO
├─ .gitignore            # MANUALE
├─ index.js              # MANUALE  (runtime extension + CLI)
├─ package.json          # MANUALE
└─ README.md             # MANUALE
```

A runtime il modulo crea una storage root (configurabile, default `./tmp/dev-test-server`) dove vengono **generate** directory `artifacts/` e `logs/`:

```
dev-test-server/
└─ tmp/dev-test-server/   # GENERATO (storage runtime)
   ├─ artifacts/          #   GENERATO (file artefatti prodotti dai job)
   └─ logs/               #   GENERATO (log di runtime)
```

## MACRO-SUDDIVISIONE: GENERATO vs MANUALE

| Elemento | Categoria | Note |
|---|---|---|
| `index.js`, `package.json`, `README.md`, `.gitignore` | **MANUALE** | codice sorgente, mai rigenerato |
| `.ares/context/`, `.ares/docs/`, `.ares/tasks/` | **MANUALE** | documentazione di contesto; i file `it/` creati non vanno sovrascritti |
| `tmp/dev-test-server/` (artifacts, logs) | **GENERATO** | storage runtime, rigenerabile e non versionato |
| `.git/`, `node_modules/` | **GENERATO** | mai versionato |

**Regola pratica**: codice e documentazione sono manuali; `tmp/` (e il datasource `maintenance` esterno, incluso `current-schemas.json`) sono generati/esterni e rigenerabili.
