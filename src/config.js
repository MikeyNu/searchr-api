import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function list(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function int(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

const root = fileURLToPath(new URL("..", import.meta.url));

function unquote(value) {
  const text = String(value || "").trim();
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function readLocalEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  const path = resolve(root, ".env");
  if (!existsSync(path)) return env;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    if (env[key] !== undefined) continue;
    env[key] = unquote(trimmed.slice(index + 1));
  }
  return env;
}

export function loadConfig(env = readLocalEnv()) {
  const dataDir = resolve(root, env.DATA_DIR || "data");
  return {
    port: int(env.PORT, 4000),
    dataDir,
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    adminToken: String(env.ADMIN_TOKEN || ""),
    ingestOnStart: bool(env.INGEST_ON_START, true),
    ingestIntervalMinutes: int(env.INGEST_INTERVAL_MINUTES, 360),
    adzuna: {
      appId: String(env.ADZUNA_APP_ID || ""),
      appKey: String(env.ADZUNA_APP_KEY || ""),
      queries: list(env.ADZUNA_QUERIES) || [],
      locations: list(env.ADZUNA_LOCATIONS) || [],
      resultsPerQuery: int(env.ADZUNA_RESULTS_PER_QUERY, 20)
    },
    greenhouseBoards: list(env.GREENHOUSE_BOARDS),
    leverCompanies: list(env.LEVER_COMPANIES),
    partnerFeedUrls: list(env.PARTNER_FEED_URLS)
  };
}

export const config = loadConfig();
