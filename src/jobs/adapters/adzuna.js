import { fetchJson } from "../../lib/fetch.js";
import { htmlToText } from "../../lib/text.js";

export function createAdzunaAdapter(settings) {
  return {
    id: "adzuna-za",
    name: "Adzuna South Africa",
    enabled: Boolean(settings.appId && settings.appKey),
    async fetchJobs() {
      if (!settings.appId || !settings.appKey) return [];
      const queries = settings.queries.length ? settings.queries : ["retail"];
      const locations = settings.locations.length ? settings.locations : ["South Africa"];
      const jobs = [];
      for (const query of queries) {
        for (const location of locations) {
          const params = new URLSearchParams({
            app_id: settings.appId,
            app_key: settings.appKey,
            results_per_page: String(settings.resultsPerQuery || 20),
            what: query,
            where: location,
            "content-type": "application/json"
          });
          const url = `https://api.adzuna.com/v1/api/jobs/za/search/1?${params.toString()}`;
          const data = await fetchJson(url);
          for (const item of data.results || []) {
            jobs.push(mapAdzunaJob(item));
          }
        }
      }
      return jobs;
    }
  };
}

function mapAdzunaJob(item) {
  const salaryMin = item.salary_min ?? null;
  const salaryMax = item.salary_max ?? null;
  return {
    source: "Adzuna ZA",
    externalId: item.id,
    canonicalUrl: item.redirect_url,
    applyUrl: item.redirect_url,
    title: item.title,
    company: item.company?.display_name || "",
    descriptionText: htmlToText(item.description || ""),
    locationText: item.location?.display_name || "",
    workplaceType: "",
    employmentType: item.contract_time || item.contract_type || "",
    salaryMin,
    salaryMax,
    salaryCurrency: "ZAR",
    postedAt: item.created,
    expiresAt: "",
    category: item.category?.label || "",
    rawPayload: item
  };
}
