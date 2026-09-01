# Obiettivo @ares/dev-test-server

## Goal (funzionale)

`@ares/dev-test-server` deve evolvere in un **server API** per:

- creare e testare applicazioni via web (workflow guidati);
- orchestrare strumenti aReS per sviluppo e manutenzione;
- esporre endpoint e/o WebSocket per sessioni e automazioni di sviluppo.

In prospettiva sarà affiancato da un **client React** dedicato.

## Dipendenze utili

- `../web-crawler`: per scraping e test di funzionalità web in pipeline controllate.
- `../scd`: per build/deploy/Git flow dove serve.
- `../programming` (compat wrapper) / `../scd/programming.js`: per astrazione di progettazione e modelli.

## Dati e persistenza

- [ ] 1. Il server deve garantire un datasource per DB di manutenzione come descritto in `../ecosystem/datasources/maintenance` (da verificare/standardizzare).

## Roadmap (ticket principali)

- [ ] 2. Definire contract API (REST) per: create-project, scaffold, run-tests, run-build, run-deploy.
- [ ] 3. Definire contract API (WebSocket) per log streaming e job progress.
- [ ] 4. Integrare un job runner (queue in-memory iniziale; persistenza quando definito il DB maintenance).
- [ ] 5. Integrare “workspace manager” (progetti, template, versioning).
- [ ] 6. Client React: UI per creare progetto, vedere log, triggerare job e gestire task.

## Done definition (stabile)

- Un percorso “create → test → build” è automatizzabile end-to-end via API.
- I job sono ripetibili e tracciati (almeno su log e stato).
- La UI React può pilotare le funzioni principali senza accesso shell.

