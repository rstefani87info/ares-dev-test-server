# Panoramica CLI — `@ares/dev-test-server`

## Bin entrypoint

| Bin | File | Scopo |
|---|---|---|
| `ares-dev-test-server` | `index.js` | Avvia il server standalone (estende anche il runtime aReS) |

## Comandi CLI

Il bin accetta i seguenti comandi:

| Comando | Scopo |
|---|---|
| `start` | Avvia Express + WS listener, mount statici, CRUD API e job runner |
| `--help` / `-h` | Stampa l'uso (comandi + flag) |

Flag per `start`:

| Flag | Default | Descrizione |
|---|---|---|
| `--port` | 3000 | Porta HTTP |
| `--ws-port` | 3001 | Porta WebSocket |
| `--storage-root` | `./tmp/dev-test-server` | Storage di runtime (artifacts/logs) |

Uso:

```bash
ares-dev-test-server --help
ares-dev-test-server start --port 3000 --ws-port 3001 --storage-root ./tmp/dev-test-server
```

Un comando sconosciuto produce `Unknown command: <cmd>` ed exit code 1.

## Script npm

| Script | Comando |
|---|---|
| `start` | `node index.js` |
| `test` | `echo "Error: no test specified" && exit 1` (placeholder) |
| `ares-dev-test-server` | `ares-dev-test-server` |

## Note

- Il modulo è anche una **estensione runtime**: `aReS.include(devTestServer)` (import `{ aReSInitialize }` o default) configura il server dentro un'istanza aReS esistente, senza avviare la CLI.
- I job eseguiti dal runner usano CLI di altri moduli: scope `scd:<comando>` su `@ares/scd/cli.js` e `core-dev:<comando>` su `@ares/core-dev/index.js`, ciascuno invocati con `--json`.
