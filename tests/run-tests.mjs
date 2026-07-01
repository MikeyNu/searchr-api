import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dataDir = await mkdtemp(join(tmpdir(), "scriptory-api-"));
process.env.DATA_DIR = dataDir;

const { createApiServer } = await import("../src/server.js");
const { normalizeJob } = await import("../src/jobs/normalize.js");
const { buildApplicationKit, scoreJob } = await import("../src/jobs/match.js");

const cv = {
  contact: { fullName: "Nomsa Candidate", location: "Johannesburg, South Africa" },
  summary: "Reliable service worker with customer service, payments, stock checks, and team support experience.",
  education: [{ qualification: "Grade 12", details: "Matric certificate" }],
  experience: [{
    role: "Customer Assistant",
    startDate: "2023",
    endDate: "2025",
    responsibilities: [
      "Assisted customers with purchases and product questions.",
      "Processed payments and checked stock."
    ]
  }],
  skills: ["Customer service", "POS systems", "Stock control", "Communication"],
  languages: ["English", "Zulu"]
};

const job = normalizeJob({
  source: "Test feed",
  externalId: "retail-1",
  canonicalUrl: "https://example.com/jobs/retail-1",
  applyUrl: "https://example.com/apply/retail-1",
  title: "Retail Customer Assistant",
  company: "Market Lane",
  locationText: "Johannesburg",
  descriptionText: "Retail customer assistant needed in Johannesburg. Requirements: Grade 12, customer service, POS, stock control, communication. 1 year experience. Do you have retail experience? When can you start?",
  postedAt: "2026-07-01"
});

assert.equal(job.salaryMin, null);
assert.equal(job.requirements.education[0], "Matric or Grade 12");
assert.ok(job.requirements.skills.includes("customer service"));

const match = scoreJob(cv, job);
assert.ok(match.score >= 70, `expected strong match, got ${match.score}`);
assert.ok(match.matched.includes("customer service"));
assert.equal(match.bucket, "Strong match");

const kit = buildApplicationKit(cv, job, match);
assert.ok(kit.coverLetter.includes("Retail Customer Assistant"));
assert.equal(kit.answers.length, 2);
assert.equal(kit.answers[0].question, "Do you have retail experience?");

const server = createApiServer();

try {
  server.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
  assert.equal(health.ok, true);

  const uploadResponse = await fetch(`${baseUrl}/v1/admin/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobs: [job] })
  }).then((response) => response.json());
  assert.equal(uploadResponse.added, 1);
  assert.equal(uploadResponse.totalJobs, 1);

  const jobsResponse = await fetch(`${baseUrl}/v1/jobs?query=retail&limit=10`).then((response) => response.json());
  assert.equal(jobsResponse.total, 1);
  assert.equal(jobsResponse.jobs[0].id, job.id);
  assert.deepEqual(jobsResponse.sources, [{ source: "Test feed", count: 1 }]);

  const matchResponse = await fetch(`${baseUrl}/v1/matches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cv, limit: 10 })
  }).then((response) => response.json());
  assert.equal(matchResponse.matches[0].job.id, job.id);
  assert.equal(matchResponse.matches[0].match.bucket, "Strong match");

  const kitResponse = await fetch(`${baseUrl}/v1/application-kits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cv, jobId: job.id })
  }).then((response) => response.json());

  assert.equal(kitResponse.match.bucket, "Strong match");
  assert.ok(kitResponse.kit.checklist.length >= 3);
} finally {
  server.close();
  await once(server, "close");
  await rm(dataDir, { recursive: true, force: true });
}

console.log("API validation passed: ingestion storage, job listing, matching, application kits, and HTTP routes are working.");
