# Documentation `@ares/dev-test-server`

## Purpose

Module-level docs for `@ares/dev-test-server`: the runtime platform (Express + `ws`) that orchestrates `@ares/core-dev` and `@ares/scd` CLIs via a hybrid job runner, exposes CRUD for 6 maintenance entities, and streams job state via WebSocket.

## Recommended Reading Path

1. **Installation + CLI quickstart** → [dev-test-server.md](./dev-test-server.md) § Standalone boot + runtime aReS.include
2. **Available endpoints** → table: `/health`, `/api/projects`, `/api/jobs/execute`, WS broadcast
3. **Hybrid runner (Strategy C)** → fast in-process set vs subprocess fire-and-forget
4. **WS job event stream** → `job:started / done / failed`
5. **Maintenance datasource** → degraded mode 503 vs `status:degraded` in /health
6. **Tickets / roadmap** → `../../tickets/` and `../../tasks/`

## Available Docs

- [dev-test-server.md](./dev-test-server.md) — main document (CLI, API, hybrid runner, WS, configuration)
- [Completion plan](./completion.md) — module progress checklist

## Note

This module is both a **standalone binary** (`ares-dev-test-server start`) and a **runtime extension `aReS.include(devTestServer)`** (mounts Express + @ares/web + @ares/web-socket inside a host aReS app).
