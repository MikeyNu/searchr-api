import { config } from "../config.js";
import { loadJobs, loadRuns, saveJobs, saveRuns } from "../lib/store.js";
import { stableHash } from "../lib/text.js";
import { createAdzunaAdapter } from "./adapters/adzuna.js";
import { createGreenhouseAdapter } from "./adapters/greenhouse.js";
import { createLeverAdapter } from "./adapters/lever.js";
import { createPartnerFeedAdapter } from "./adapters/partner-feed.js";
import { normalizeJob } from "./normalize.js";

export function configuredSources(settings = config) {
  return [
    createAdzunaAdapter(settings.adzuna),
    ...settings.greenhouseBoards.map(createGreenhouseAdapter),
    ...settings.leverCompanies.map(createLeverAdapter),
    ...settings.partnerFeedUrls.map(createPartnerFeedAdapter)
  ];
}

export async function runIngestion(settings = config) {
  const startedAt = new Date().toISOString();
  const sources = configuredSources(settings);
  const existing = await loadJobs();
  const byKey = new Map(existing.map((job) => [dedupeKey(job), job]));
  const reports = [];
  let fetchedCount = 0;
  let upsertedCount = 0;
  let failedCount = 0;

  for (const source of sources) {
    const report = {
      id: source.id,
      name: source.name,
      enabled: source.enabled,
      fetched: 0,
      upserted: 0,
      failed: 0,
      error: ""
    };
    if (!source.enabled) {
      reports.push(report);
      continue;
    }
    try {
      const rawJobs = await source.fetchJobs();
      report.fetched = rawJobs.length;
      fetchedCount += rawJobs.length;
      for (const raw of rawJobs) {
        try {
          const normalized = normalizeJob(raw);
          if (!normalized.title || !normalized.descriptionText) continue;
          const key = dedupeKey(normalized);
          const previous = byKey.get(key);
          const saved = {
            ...(previous || {}),
            ...normalized,
            firstSeenAt: previous?.firstSeenAt || startedAt,
            lastSeenAt: startedAt,
            updatedAt: startedAt,
            status: "active"
          };
          byKey.set(key, saved);
          report.upserted += 1;
          upsertedCount += 1;
        } catch (error) {
          report.failed += 1;
          failedCount += 1;
        }
      }
    } catch (error) {
      report.error = error.message;
      report.failed += 1;
      failedCount += 1;
    }
    reports.push(report);
  }

  const jobs = [...byKey.values()]
    .map((job) => markExpired(job, startedAt))
    .sort((a, b) => Date.parse(b.postedAt || b.updatedAt || b.firstSeenAt || 0) - Date.parse(a.postedAt || a.updatedAt || a.firstSeenAt || 0));

  await saveJobs(jobs);
  const run = {
    id: `run-${Date.now()}`,
    startedAt,
    finishedAt: new Date().toISOString(),
    fetchedCount,
    upsertedCount,
    failedCount,
    sources: reports
  };
  const runs = await loadRuns();
  await saveRuns([run, ...runs].slice(0, 100));
  return { run, jobs };
}

function dedupeKey(job) {
  return job.externalId
    ? `${job.source}|${job.externalId}`
    : stableHash([job.canonicalUrl, job.applyUrl, job.title, job.company, job.locationText].join("|"));
}

function markExpired(job, nowIso) {
  if (!job.expiresAt) return job;
  const expires = Date.parse(job.expiresAt);
  if (!Number.isNaN(expires) && expires < Date.parse(nowIso)) {
    return { ...job, status: "expired" };
  }
  return job;
}
