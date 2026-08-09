# Documentazione @ares/dev-test-server

## Scopo

Test server and devops module of aReS framework.

## Installazione

```bash
yarn add @ares/dev-test-server
```

In un monorepo Yarn Workspaces:

```bash
yarn workspace <app> add @ares/dev-test-server
```

## Quickstart

Esempio d’uso da CLI (se previsto dal package):

```bash
node index.js
```

## API pubbliche (exports)

Questa sezione documenta la superficie pubblica reale a livello di entrypoint e simboli principali.

Entrypoint root:

- `@ares/dev-test-server`

File principali nel root del package (indicativi):

- `index.js`

## Configurazione (appSetup / config / policies)

Questo modulo può leggere configurazioni da `appSetup`, `config` o `policies` a seconda del tipo. Documenta qui le chiavi effettivamente consumate quando stabilizzi il contract.

## Test

Esecuzione test del modulo (se presenti):

```bash
yarn workspace @ares/dev-test-server test
```

## Note

- Questo documento è mantenuto in parallelo ai ticket del modulo.
