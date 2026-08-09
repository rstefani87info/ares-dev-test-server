# @ares/dev-test-server Documentation

## Purpose

Test server and devops module of aReS framework.

## Installation

```bash
yarn add @ares/dev-test-server
```

In a Yarn Workspaces monorepo:

```bash
yarn workspace <app> add @ares/dev-test-server
```

## Quickstart

CLI usage example (if exposed by the package):

```bash
node index.js
```

## Public API (exports)

This section documents the actual public surface at entrypoint level and main exported symbols.

Root entrypoint:

- `@ares/dev-test-server`

Main files at package root (indicative):

- `index.js`

## Configuration (appSetup / config / policies)

This module may read configuration from `appSetup`, `config`, or `policies` depending on the type. Document the actually consumed keys as you stabilize the contract.

## Test

Run module tests (if present):

```bash
yarn workspace @ares/dev-test-server test
```

## Notes

- This document is maintained alongside the module tickets.
