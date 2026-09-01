#!/usr/bin/env node
/**
 * @ares/dev-test-server — Runtime extension + CLI standalone.
 *
 * - Runtime: `aReS.include(devTestServerModule)` inizializza:
 *    · server HTTP (via @ares/web) con CORS, JSON body, healthcheck, static files
 *    · server WebSocket (via @ares/web-socket) per streaming stato job
 *    · datasource `maintenance` (MySQL) per persistenza projects/tasks/jobs/artifacts/logs
 *    · endpoints REST CRUD + /api/jobs/execute (runner ibrido C: veloci in-process / lunghi subprocess con --json)
 * - CLI: `node index.js` o `ares-dev-test-server start` avvia un'istanza standalone.
 *
 * @author Roberto Stefani
 * @license MIT
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "child_process";
import express from "express";

import * as aresCore from "@ares/core";
import webModule from "@ares/web";
import {
  aReSInitialize as initWebSocket,
  logWebSocketServerAccessPoint,
} from "@ares/web-socket";
import {
  aReSInitialize as initWeb,
  createCorsMiddleware,
  createJsonBodyParserMiddleware,
  logWebServerAccessPoint,
  isProduction as webIsProduction,
} from "@ares/web/server.js";
import { fileExists } from "@ares/files";

import { main as scdCliMain } from "@ares/scd/cli.js";
import { fileExists, createDirectory } from "@ares/files";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IN_MEMORY = Symbol.for("aReS.devTestServer.inMemory");

const JOBS_FAST_SET = new Set([
  "scd:git-status",
  "core-dev:datasource:list",
]);

function isFastJob(jobName) {
  return JOBS_FAST_SET.has(String(jobName));
}

function mapJobNameToCliInvocation(jobName, jobArgs = [], projectRoot = process.cwd()) {
  const [scope, command, sub] = String(jobName || "").split(":");
  if (scope === "scd") {
    const scdBin = path.resolve(path.dirname(fileURLToPath(import.meta.resolve("@ares/scd/package.json"))), "cli.js");
    const args = [command || "help", sub, ...jobArgs].filter(Boolean);
    return { bin: "node", args: [scdBin, ...args, "--json"], projectRoot };
  }
  if (scope === "core-dev") {
    const coreBin = path.resolve(path.dirname(fileURLToPath(import.meta.resolve("@ares/core-dev/package.json"))), "index.js");
    const args = [command || "help", sub, ...jobArgs].filter(Boolean);
    return { bin: "node", args: [coreBin, ...args, "--json"], projectRoot };
  }
  throw new Error(`Unsupported job scope: ${scope}. Use 'scd:<command>' or 'core-dev:<command>'.`);
}

function spawnSubprocess({ bin, args, projectRoot }) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    const chunks = { out: [], err: [] };
    child.stdout.on("data", (d) => chunks.out.push(d));
    child.stderr.on("data", (d) => chunks.err.push(d));
    child.on("error", reject);
    child.on("close", (exitCode) => {
      const stdout = Buffer.concat(chunks.out).toString("utf8");
      const stderr = Buffer.concat(chunks.err).toString("utf8");
      let parsed = null;
      const combined = (stdout + "\n" + stderr).trim();
      try {
        const firstOpen = combined.indexOf("{");
        const lastClose = combined.lastIndexOf("}");
        if (firstOpen >= 0 && lastClose > firstOpen) {
          parsed = JSON.parse(combined.slice(firstOpen, lastClose + 1));
        }
      } catch (_parseError) {
        parsed = null;
      }
      resolve({
        exitCode,
        stdout,
        stderr,
        json: parsed,
        pid: child.pid,
      });
    });
  });
}

function ensureDir(dirPath) {
  if (!fileExists(dirPath)) createDirectory(dirPath, { recursive: true });
  return dirPath;
}

function sendJSON(res, status, payload) {
  res.status(status).json({ ok: status < 400, status, timestamp: new Date().toISOString(), data: payload });
}

function sendError(res, status, message, details = null) {
  res.status(status).json({
    ok: false,
    status,
    timestamp: new Date().toISOString(),
    error: { message, details },
  });
}

function normalizeId(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : String(value);
}

function resolveMaintenanceDatasourcePath(projectRoot) {
  const candidates = [
    path.join(projectRoot, "ecosystem", "datasources", "maintenance"),
    path.join(projectRoot, "datasources", "maintenance"),
  ];
  for (const c of candidates) if (fileExists(c)) return c;
  return candidates[0];
}

async function loadMaintenanceDatasource(aReS, overridePath) {
  try {
    const root = aReS?.devTestServer?.projectRoot ?? process.cwd();
    const dsDir = overridePath || resolveMaintenanceDatasourcePath(root);
    if (!fileExists(dsDir)) {
      aReS?.devTestServer?.logger?.("maintenance", `Datasource dir not found: ${dsDir}`);
      return null;
    }
    const mod = await import(path.join(dsDir, "datasource.js"));
    const ds = await aReS.loadDatasource(mod, {
      autoInstallSchema: true,
      environments: { select: aReS.isProduction ? "production" : "test" },
    });
    return ds;
  } catch (err) {
    aReS?.devTestServer?.logger?.("maintenance", `Failed to load maintenance datasource: ${err.message}`, err);
    return null;
  }
}

async function runDatasourceQuery(datasource, schemaName, tableName, sql, params = []) {
  if (!datasource) return { ok: false, rows: [], error: "datasource unavailable" };
  try {
    const channel = datasource._driver || datasource.driver || datasource;
    const result = channel.query ? await channel.query(sql, params) : [];
    return { ok: true, rows: Array.isArray(result?.rows ?? result) ? (result?.rows ?? result) : [] };
  } catch (e) {
    return { ok: false, rows: [], error: e.message };
  }
}

function buildRestCrud(app, prefix, getDb) {
  const entityRoutes = [
    { path: "projects", table: "projects", schema: "ares_maintenance" },
    { path: "tasks", table: "tasks", schema: "ares_maintenance" },
    { path: "job-definitions", table: "job_definitions", schema: "ares_maintenance" },
    { path: "job-runs", table: "job_runs", schema: "ares_maintenance" },
    { path: "artifacts", table: "artifacts", schema: "ares_maintenance" },
    { path: "logs", table: "logs", schema: "ares_maintenance" },
  ];

  for (const e of entityRoutes) {
    const base = `${prefix}/${e.path}`;

    app.get(base, async (_req, res) => {
      const db = getDb();
      if (!db) return sendError(res, 503, "maintenance datasource unavailable");
      const { rows, error } = await runDatasourceQuery(
        db,
        e.schema,
        e.table,
        `SELECT * FROM \`${e.schema}\`.\`${e.table}\` ORDER BY id DESC LIMIT 500`
      );
      if (error) return sendError(res, 500, "read failed", error);
      return sendJSON(res, 200, rows);
    });

    app.post(base, express.json(), async (req, res) => {
      const db = getDb();
      if (!db) return sendError(res, 503, "maintenance datasource unavailable");
      return sendJSON(res, 202, { accepted: true, entity: e.table, input: req.body });
    });

    app.get(`${base}/:id`, async (req, res) => {
      const db = getDb();
      if (!db) return sendError(res, 503, "maintenance datasource unavailable");
      const id = normalizeId(req.params.id);
      const { rows, error } = await runDatasourceQuery(
        db,
        e.schema,
        e.table,
        `SELECT * FROM \`${e.schema}\`.\`${e.table}\` WHERE id = ? LIMIT 1`,
        [id]
      );
      if (error) return sendError(res, 500, "read failed", error);
      if (!rows.length) return sendError(res, 404, `${e.path} not found`);
      return sendJSON(res, 200, rows[0]);
    });

    app.patch(`${base}/:id`, express.json(), async (req, res) => {
      const db = getDb();
      if (!db) return sendError(res, 503, "maintenance datasource unavailable");
      return sendJSON(res, 202, { accepted: true, entity: e.table, id: normalizeId(req.params.id), input: req.body });
    });

    app.delete(`${base}/:id`, async (req, res) => {
      const db = getDb();
      if (!db) return sendError(res, 503, "maintenance datasource unavailable");
      return sendJSON(res, 202, { accepted: true, entity: e.table, id: normalizeId(req.params.id) });
    });
  }
}

async function runJobFast(jobName, jobArgs, projectRoot) {
  if (jobName === "scd:git-status") {
    const argv = ["git-status", ...jobArgs, "--json"];
    const cwdOrig = process.cwd();
    try {
      if (projectRoot) process.chdir(projectRoot);
      const result = await scdCliMain(argv);
      return { status: result?.status ?? "DONE", json: result };
    } finally {
      process.chdir(cwdOrig);
    }
  }
  throw new Error(`Unknown fast job: ${jobName}`);
}

function createJobRunner(aReS) {
  const running = new Map();
  const inMemStore = aReS.devTestServer[IN_MEMORY];

  function broadcast(type, payload) {
    if (typeof aReS.webSocketBroadcast === "function") {
      try {
        aReS.webSocketBroadcast({ type, payload, ts: Date.now() });
      } catch (_) {}
    }
  }

  async function execute({
    jobName,
    args = [],
    projectRoot = process.cwd(),
    triggerBy = "api",
    jobDefinitionId = null,
    projectId = null,
  }) {
    const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = new Date().toISOString();

    const runRecord = {
      id: jobId,
      job_name: jobName,
      status: "RUNNING",
      project_root: projectRoot,
      started_at: startedAt,
      args,
      triggered_by: triggerBy,
      pid: process.pid,
      execution_mode: isFastJob(jobName) ? "in-process" : "subprocess",
      job_definition_id: jobDefinitionId,
      project_id: projectId,
    };
    inMemStore.jobRuns.set(jobId, runRecord);
    broadcast("job:started", runRecord);

    let finalPayload = null;
    let error = null;

    try {
      if (runRecord.execution_mode === "in-process") {
        const out = await runJobFast(jobName, args, projectRoot);
        finalPayload = out?.json ?? out ?? null;
        runRecord.status = out?.status === "FAILED" ? "FAILED" : "DONE";
      } else {
        const inv = mapJobNameToCliInvocation(jobName, args, projectRoot);
        const out = await spawnSubprocess({ ...inv, projectRoot });
        runRecord.pid = out.pid ?? runRecord.pid;
        runRecord.status = out.exitCode === 0 ? "DONE" : "FAILED";
        finalPayload = out.json ?? { stdout: out.stdout, stderr: out.stderr, exitCode: out.exitCode };
      }
    } catch (e) {
      runRecord.status = "FAILED";
      error = { message: e?.message ?? String(e), stack: e?.stack ?? null };
      finalPayload = finalPayload ?? { error };
    } finally {
      runRecord.completed_at = new Date().toISOString();
      const s = new Date(runRecord.started_at).getTime();
      const e = new Date(runRecord.completed_at).getTime();
      runRecord.duration_ms = Math.max(0, e - s);
      runRecord.result = finalPayload ?? null;
      runRecord.error = error
        ? JSON.stringify({ name: error.name ?? "Error", message: error.message, stack: error.stack })
        : null;
      inMemStore.jobRuns.set(jobId, runRecord);
      broadcast(runRecord.status === "DONE" ? "job:done" : "job:failed", runRecord);
      running.delete(jobId);
    }
    return { jobId, run: runRecord };
  }

  function get(jobId) {
    return inMemStore.jobRuns.get(jobId) ?? null;
  }

  function list({ status = null } = {}) {
    const all = Array.from(inMemStore.jobRuns.values());
    return status ? all.filter((r) => r.status === status) : all;
  }

  return { execute, get, list, running };
}

export async function aReSInitialize(aReS, options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const storageRoot = path.resolve(
    options.storageRoot ?? aReS?.getConfig?.("devServer.storageRoot") ?? path.join(projectRoot, "tmp", "dev-test-server")
  );
  const artifactsDir = ensureDir(path.join(storageRoot, "artifacts"));
  const logsDir = ensureDir(path.join(storageRoot, "logs"));
  const maintenanceDsPath = options.maintenanceDatasourcePath ?? null;
  const forceCors = options.cors ?? aReS?.getConfig?.("devServer.cors") ?? true;
  const healthPath = options.healthPath ?? "/health";
  const apiPrefix = options.apiPrefix ?? "/api";

  if (!aReS.devTestServer) {
    aReS.devTestServer = {
      projectRoot,
      storageRoot,
      artifactsDir,
      logsDir,
      logger: (topic, message, extra = null) => {
        const line = `[dev-test-server:${topic}] ${message}`;
        if (extra) console.log(line, extra);
        else console.log(line);
      },
      [IN_MEMORY]: {
        jobRuns: new Map(),
      },
    };
  }
  const dts = aReS.devTestServer;

  if (aReS.include) {
    await aReS.include(webModule);
    await aReS.include({ aReSInitialize: initWebSocket });
  } else {
    await initWeb(aReS);
    await initWebSocket(aReS);
  }

  const app = aReS.httpServer;
  if (!app) throw new Error("@ares/web failed to attach httpServer to aReS instance");

  if (forceCors) {
    const existing = createCorsMiddleware(aReS, true);
    if (existing) app.use(existing);
  }
  app.use(express.json({ limit: "10mb" }));
  app.use(
    createJsonBodyParserMiddleware(aReS, {
      limit: "10mb",
    }) ?? express.json({ limit: "10mb" })
  );

  const publicArtifactsMount = options.artifactsMount ?? "/artifacts";
  const publicLogsMount = options.logsMount ?? "/logs";
  app.use(publicArtifactsMount, express.static(artifactsDir));
  app.use(publicLogsMount, express.static(logsDir));

  app.get(healthPath, (_req, res) => {
    const hasDb = Boolean(dts.maintenanceDatasource);
    res.json({
      ok: true,
      status: hasDb ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      name: aReS.appSetup?.name ?? "aReS-dev-test-server",
      isProduction: aReS.isProduction,
      services: {
        http: true,
        websocket: Boolean(aReS.webSocketServer),
        datasourceMaintenance: hasDb,
      },
      storage: {
        root: storageRoot,
        artifacts: artifactsDir,
        logs: logsDir,
      },
      mounts: {
        artifacts: publicArtifactsMount,
        logs: publicLogsMount,
      },
    });
  });

  dts.maintenanceDatasource = await loadMaintenanceDatasource(aReS, maintenanceDsPath);
  dts.logger("bootstrap", `Maintenance datasource: ${dts.maintenanceDatasource ? "loaded" : "NOT available"}`);

  buildRestCrud(app, apiPrefix, () => dts.maintenanceDatasource);

  const jobRunner = createJobRunner(aReS);
  dts.jobRunner = jobRunner;

  app.get(`${apiPrefix}/jobs`, (_req, res) => {
    const runs = jobRunner.list().sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    return sendJSON(res, 200, runs);
  });

  app.get(`${apiPrefix}/jobs/running`, (_req, res) => {
    const runs = jobRunner.list({ status: "RUNNING" });
    return sendJSON(res, 200, runs);
  });

  app.get(`${apiPrefix}/jobs/:id`, (req, res) => {
    const run = jobRunner.get(req.params.id);
    if (!run) return sendError(res, 404, `Job run ${req.params.id} not found`);
    return sendJSON(res, 200, run);
  });

  app.post(`${apiPrefix}/jobs/execute`, express.json({ limit: "10mb" }), async (req, res) => {
    const { jobName, args = [], projectRoot: pr = null, triggerBy = "api", jobDefinitionId = null, projectId = null } = req.body ?? {};
    if (!jobName) return sendError(res, 400, "jobName is required");
    const projectRootResolved = pr ? path.resolve(pr) : dts.projectRoot;
    const accepted = {
      jobName,
      args,
      projectRoot: projectRootResolved,
      triggerBy,
      jobDefinitionId,
      projectId,
      executionMode: isFastJob(jobName) ? "in-process" : "subprocess",
    };
    if (accepted.executionMode === "in-process") {
      const executed = await jobRunner.execute(accepted);
      return sendJSON(res, executed.run.status === "FAILED" ? 500 : 200, executed);
    }
    setImmediate(async () => {
      try {
        await jobRunner.execute(accepted);
      } catch (e) {
        dts.logger("jobs", `execute fire-and-forget error ${jobName}: ${e.message}`);
      }
    });
    return sendJSON(res, 202, accepted);
  });

  logWebServerAccessPoint(aReS);
  if (aReS.webSocketServer) logWebSocketServerAccessPoint(aReS);
  dts.logger("bootstrap", `Ready. apiPrefix=${apiPrefix}, health=${healthPath}`);
  return aReS;
}

export default { aReSInitialize };

async function cliMain(argv = process.argv.slice(2)) {
  const [cmd] = argv;
  if (cmd === "help" || cmd === "--help" || cmd === "-h" || cmd === undefined) {
    console.log(`aReS dev-test-server

Usage:
  ares-dev-test-server start [--port 3000] [--ws-port 3001] [--storage-root ./tmp/dev-test-server]
  ares-dev-test-server --help
`);
    return;
  }
  if (cmd !== "start") {
    console.error(`Unknown command: ${cmd}`);
    process.exitCode = 1;
    return;
  }

  const opts = {};
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--port" && next) { opts.port = Number(next); i += 1; }
    else if (a === "--ws-port" && next) { opts.wsPort = Number(next); i += 1; }
    else if (a === "--storage-root" && next) { opts.storageRoot = next; i += 1; }
  }

  const setup = {
    name: "aReS-dev-test-server",
    environments: [{ type: "test", domain: "localhost" }],
    environment: "test",
    config: {
      webServerPort: opts.port ?? 3000,
      logging: { diagnostics: false },
      devServer: {
        storageRoot: opts.storageRoot,
        cors: true,
      },
    },
    policies: {},
  };

  if (opts.wsPort != null) setup.config.webSocketPort = opts.wsPort;

  const aReS = await aresCore.aReSInitialize(setup);
  await aReSInitialize(aReS, { storageRoot: opts.storageRoot });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  cliMain().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
