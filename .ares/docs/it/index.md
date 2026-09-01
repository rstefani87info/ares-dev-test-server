# Documentazione `@ares/dev-test-server`

## Scopo

Questa cartella documenta `@ares/dev-test-server`: piattaforma runtime (Express + ws) che orchestra CLI `@ares/core-dev` e `@ares/scd` con runner ibrido, CRUD 6 entità maintenance e streaming WebSocket di stato job.

## Percorso di Lettura Consigliato

1. **Installazione + Quickstart CLI** → [dev-test-server.md](./dev-test-server.md) § Avvio standalone + estensione runtime
2. **Endpoint disponibili** → tabella `/health`, `/api/projects`, `/api/jobs/execute`, WS broadcast
3. **Runner ibrido (Strategia C)** → fast set in-process + subprocess fire-and-forget
4. **Streaming WS eventi job** → `job:started / done / failed`
5. **Datasource maintenance** → modalità degradata 503 / `status:degraded` in /health
6. **Ticket / roadmap** → `../../tickets/` e `../../tasks/`

## Documenti Disponibili

- [dev-test-server.md](./dev-test-server.md) — documento principale (CLI, API, runner ibrido, WS, configurazione)
- [Piano di completamento](./completamento.md) — checklist avanzamento modulo

## Nota

Il modulo è sia **bin standalone** (`ares-dev-test-server start`) sia **estensione runtime `aReS.include(devTestServer)`** (include Express + @ares/web + @ares/web-socket in app host aReS).
