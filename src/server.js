import { createServer } from "node:http";
import { URL, fileURLToPath } from "node:url";
import { config } from "./config.js";
import { corsHeaders } from "./http/cors.js";
import { methodNotAllowed, notFound, readJson, sendJson } from "./http/respond.js";
import { buildApplicationKit, scoreJob } from "./jobs/match.js";
import { runIngestion, configuredSources } from "./jobs/ingest.js";
import { normalizeMany, normalizeJob } from "./jobs/normalize.js";
import { loadApplications, loadJobs, loadRuns, saveApplications, saveJobs } from "./lib/store.js";
import { clean } from "./lib/text.js";

let ingestionInFlight = null;

export function createApiServer() {
  return createServer(async (req, res) => {
    const headers = corsHeaders(req.headers.origin);
    if (req.method === "OPTIONS") {
      res.writeHead(204, headers);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      await route(req, res, url, headers);
    } catch (error) {
      const status = error.statusCode || 500;
      sendJson(res, status, { error: status === 500 ? "Internal server error" : error.message }, headers);
      if (status === 500) console.error(error);
    }
  });
}

async function route(req, res, url, headers) {
  if (url.pathname === "/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, service: "scriptory-api", time: new Date().toISOString() }, headers);
    return;
  }

  if (url.pathname === "/v1/sources" && req.method === "GET") {
    const sources = configuredSources().map((source) => ({
      id: source.id,
      name: source.name,
      enabled: source.enabled
    }));
    const runs = await loadRuns();
    sendJson(res, 200, { sources, lastRun: runs[0] || null }, headers);
    return;
  }

  if (url.pathname === "/v1/ingest/run" && req.method === "POST") {
    requireAdmin(req);
    const result = await triggerIngestion("api");
    sendJson(res, 200, {
      run: result.run,
      totalJobs: result.jobs.length
    }, headers);
    return;
  }

  if (url.pathname === "/v1/admin/jobs" && req.method === "POST") {
    requireAdmin(req);
    const body = await readJson(req);
    const incoming = normalizeMany(Array.isArray(body) ? body : body.jobs);
    const existing = await loadJobs();
    const merged = mergeJobs(existing, incoming);
    await saveJobs(merged);
    sendJson(res, 200, { added: incoming.length, totalJobs: merged.length }, headers);
    return;
  }

  if (url.pathname === "/v1/jobs" && req.method === "GET") {
    const jobs = await loadJobs();
    const result = queryJobs(jobs, url.searchParams);
    sendJson(res, 200, result, headers);
    return;
  }

  const jobId = url.pathname.match(/^\/v1\/jobs\/([^/]+)$/)?.[1];
  if (jobId && req.method === "GET") {
    const jobs = await loadJobs();
    const job = jobs.find((item) => item.id === decodeURIComponent(jobId));
    if (!job) return notFound(res, headers);
    sendJson(res, 200, { job }, headers);
    return;
  }

  if (url.pathname === "/v1/matches" && req.method === "POST") {
    const body = await readJson(req);
    const cv = body.cv || {};
    const jobs = body.jobs ? normalizeMany(body.jobs) : await loadJobs();
    const limit = clamp(Number(body.limit || 100), 1, 500);
    const matches = jobs
      .filter((job) => job.status !== "expired")
      .map((job) => ({ job, match: scoreJob(cv, job) }))
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, limit);
    sendJson(res, 200, { matches }, headers);
    return;
  }

  if (url.pathname === "/v1/application-kits" && req.method === "POST") {
    const body = await readJson(req);
    const cv = body.cv || {};
    const job = body.job ? normalizeJob(body.job) : (await loadJobs()).find((item) => item.id === body.jobId);
    if (!job) {
      const error = new Error("Job not found.");
      error.statusCode = 404;
      throw error;
    }
    const match = scoreJob(cv, job);
    const kit = buildApplicationKit(cv, job, match);
    sendJson(res, 200, { job, match, kit }, headers);
    return;
  }

  if (url.pathname === "/v1/applications" && req.method === "GET") {
    sendJson(res, 200, { applications: await loadApplications() }, headers);
    return;
  }

  if (url.pathname === "/v1/applications" && req.method === "POST") {
    const body = await readJson(req);
    const applications = await loadApplications();
    const application = {
      id: `app-${Date.now()}`,
      jobId: clean(body.jobId),
      status: clean(body.status || "Started"),
      method: clean(body.method || "External"),
      notes: clean(body.notes),
      startedAt: new Date().toISOString(),
      submittedAt: body.status === "Submitted" ? new Date().toISOString() : "",
      events: [{ status: clean(body.status || "Started"), at: new Date().toISOString() }]
    };
    applications.unshift(application);
    await saveApplications(applications);
    sendJson(res, 201, { application }, headers);
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    methodNotAllowed(res, headers);
    return;
  }
  notFound(res, headers);
}

export function startIngestionScheduler() {
  if (!hasEnabledSources()) return;
  if (config.ingestOnStart) {
    setTimeout(() => {
      triggerIngestion("startup").catch((error) => {
        console.error(`Startup ingestion failed: ${error.message}`);
      });
    }, 500);
  }
  if (config.ingestIntervalMinutes > 0) {
    const timer = setInterval(() => {
      triggerIngestion("scheduled").catch((error) => {
        console.error(`Scheduled ingestion failed: ${error.message}`);
      });
    }, config.ingestIntervalMinutes * 60000);
    timer.unref?.();
  }
}

export async function triggerIngestion(reason = "manual") {
  if (ingestionInFlight) return ingestionInFlight;
  ingestionInFlight = runIngestion()
    .then((result) => {
      console.log(`Ingestion ${reason}: ${result.run.fetchedCount} fetched, ${result.run.upsertedCount} upserted, ${result.run.failedCount} failed.`);
      return result;
    })
    .finally(() => {
      ingestionInFlight = null;
    });
  return ingestionInFlight;
}

function hasEnabledSources() {
  return configuredSources().some((source) => source.enabled);
}

function queryJobs(jobs, params) {
  const query = clean(params.get("query")).toLowerCase();
  const location = clean(params.get("location")).toLowerCase();
  const source = clean(params.get("source")).toLowerCase();
  const workplace = clean(params.get("workplace")).toLowerCase();
  const limit = clamp(Number(params.get("limit") || 100), 1, 500);
  const offset = clamp(Number(params.get("offset") || 0), 0, 100000);
  const activeOnly = params.get("includeExpired") !== "true";
  const filtered = jobs.filter((job) => {
    const haystack = [job.title, job.company, job.descriptionText, job.category].join(" ").toLowerCase();
    if (activeOnly && job.status === "expired") return false;
    if (query && !haystack.includes(query)) return false;
    if (location && !String(job.locationText || "").toLowerCase().includes(location)) return false;
    if (source && !String(job.source || "").toLowerCase().includes(source)) return false;
    if (workplace && String(job.workplaceType || "").toLowerCase() !== workplace) return false;
    return true;
  });
  return {
    total: filtered.length,
    limit,
    offset,
    jobs: filtered.slice(offset, offset + limit),
    sources: summarizeSources(filtered)
  };
}

function summarizeSources(jobs) {
  const counts = new Map();
  jobs.forEach((job) => counts.set(job.source || "Unknown", (counts.get(job.source || "Unknown") || 0) + 1));
  return [...counts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}

function mergeJobs(existing, incoming) {
  const map = new Map(existing.map((job) => [job.id, job]));
  const now = new Date().toISOString();
  incoming.forEach((job) => {
    map.set(job.id, {
      ...(map.get(job.id) || {}),
      ...job,
      firstSeenAt: map.get(job.id)?.firstSeenAt || now,
      lastSeenAt: now,
      updatedAt: now
    });
  });
  return [...map.values()].sort((a, b) => Date.parse(b.postedAt || b.updatedAt || 0) - Date.parse(a.postedAt || a.updatedAt || 0));
}

function requireAdmin(req) {
  if (!config.adminToken) return;
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token !== config.adminToken) {
    const error = new Error("Admin token required.");
    error.statusCode = 401;
    throw error;
  }
}

function clamp(value, min, max) {
  const number = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, number));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createApiServer().listen(config.port, () => {
    console.log(`Scriptory API listening on http://127.0.0.1:${config.port}`);
    startIngestionScheduler();
  });
}
