import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";

const files = {
  jobs: "jobs.json",
  runs: "ingestion-runs.json",
  applications: "applications.json"
};

async function ensureDir() {
  await mkdir(config.dataDir, { recursive: true });
}

async function readJson(name, fallback) {
  await ensureDir();
  try {
    const text = await readFile(join(config.dataDir, files[name]), "utf8");
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

async function writeJson(name, value) {
  await ensureDir();
  await writeFile(join(config.dataDir, files[name]), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function loadJobs() {
  return readJson("jobs", []);
}

export async function saveJobs(jobs) {
  await writeJson("jobs", jobs);
}

export async function loadRuns() {
  return readJson("runs", []);
}

export async function saveRuns(runs) {
  await writeJson("runs", runs);
}

export async function loadApplications() {
  return readJson("applications", []);
}

export async function saveApplications(applications) {
  await writeJson("applications", applications);
}
