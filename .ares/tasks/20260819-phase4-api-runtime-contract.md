# Fase 4 – contratto API runtime @ares/dev-test-server (ticket)

## Scopo

Definire `@ares/dev-test-server` come boundary di orchestrazione tra:

- CLI e job definiti nei moduli aReS;
- client esterni;
- persistenza di stato e log.

## Superfici runtime

- REST API;
- WebSocket;
- runner di job;
- persistenza verso maintenance datasource.

## Contratto REST minimo (capability)

- `create-project`
- `scaffold-datasource`
- `run-tests`
- `run-build`
- `run-deploy`
- `job-status`

## Contratto WebSocket minimo

- streaming log;
- avanzamento job;
- eventi di completamento;
- segnalazione errori.

## Contratto job runtime

Il server consuma il lessico dei job provenienti da `@ares/core-dev` e `@ares/scd` (no modello parallelo).

Ogni job orchestrato ha almeno:

- identificatore;
- tipo;
- stato;
- timestamp;
- target progetto/workspace;
- output e artefatti;
- log o stream eventi.

## Persistenza minima

Appoggiarsi al maintenance datasource condiviso, almeno per:

- project/workspace;
- definizione job;
- esecuzione job;
- log;
- artefatti.

## Criterio di maturità (fase 4)

Un flusso minimo `create -> scaffold -> test/build` è pilotabile via API senza dipendere da shell manuale.

## Nice to have

### Contratti da estrarre

- `ApiJobContract` condiviso tra REST, WebSocket e persistence;
- `JobEventEnvelope` per streaming uniforme di progress/log/error;
- `WorkspaceSessionContract` per sessioni lunghe o multiutente.

### Dipendenze aReS da valutare

- `@ares/core-dev` e `@ares/scd` come provider ufficiali di job;
- `@ares/project-manager` per collegare run e planning;
- `@ares/core` / `@ares/files` per config, workspace e logging.

### Vendor o librerie utili

| Pacchetto | Pagina web | URL git | Comando yarn |
|---|---|---|---|
| `fastify` | https://www.npmjs.com/package/fastify | https://github.com/fastify/fastify | `yarn add fastify` |
| `express` | https://www.npmjs.com/package/express | https://github.com/expressjs/express | `yarn add express` |
| `ws` | https://www.npmjs.com/package/ws | https://github.com/websockets/ws | `yarn add ws` |
| `socket.io` | https://www.npmjs.com/package/socket.io | https://github.com/socketio/socket.io | `yarn add socket.io` |
| `pino` | https://www.npmjs.com/package/pino | https://github.com/pinojs/pino | `yarn add pino` |
| `zod` | https://www.npmjs.com/package/zod | https://github.com/colinhacks/zod | `yarn add zod` |
| `ajv` | https://www.npmjs.com/package/ajv | https://github.com/ajv-validator/ajv | `yarn add ajv` |

### Helper e classi utili

- `JobOrchestrator`;
- `JobStreamBroker`;
- `WorkspaceRuntimeRegistry`.

## Backlog ereditato (ex checklist 2026-05-06)

- [ ] 1. Rafforzare esempi d’uso reali (quickstart) e casi d’uso
- [ ] 2. Aggiungere/rafforzare smoke test
- [ ] 3. Documentare entrypoint stabili vs opzionali vs transizionali
- [ ] 4. Aggiornare esempi per aderire a import ESM con estensione quando possibile
- [ ] 5. Verificare `exports` (se usato) e compatibilità import ESM/CJS
- [ ] 6. Verificare `main`, `types` e file pubblicati
- [ ] 7. Verificare dipendenze runtime vs devDependencies
- [ ] 8. Dichiarare peerDependencies dove necessario
- [ ] 9. Gestire errori e fallback di configurazione in modo esplicito
- [ ] 10. Evitare side effects non opt-in (logging, IO, network) se possibile
- [ ] 11. Aggiungere/eseguire test (`yarn workspace ... test`)
- [ ] 12. Aggiungere lint/format se previsto dal workspace
- [ ] 13. Completare sezione configurazione con chiavi realmente consumate
- [ ] 14. Aggiungere riferimenti incrociati verso moduli dipendenti (core/web/files, ecc.)
