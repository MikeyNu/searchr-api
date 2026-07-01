import { runIngestion } from "../jobs/ingest.js";

const result = await runIngestion();
console.log(JSON.stringify({
  run: result.run,
  totalJobs: result.jobs.length
}, null, 2));
