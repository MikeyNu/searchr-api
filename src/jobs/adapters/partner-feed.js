import { fetchJson } from "../../lib/fetch.js";
import { htmlToText } from "../../lib/text.js";

export function createPartnerFeedAdapter(feedUrl) {
  return {
    id: `partner-${Buffer.from(feedUrl).toString("base64url").slice(0, 24)}`,
    name: `Partner feed`,
    enabled: Boolean(feedUrl),
    async fetchJobs() {
      if (!feedUrl) return [];
      const data = await fetchJson(feedUrl);
      const rows = Array.isArray(data) ? data : Array.isArray(data.jobs) ? data.jobs : [];
      return rows.map((item) => mapPartnerJob(item, feedUrl));
    }
  };
}

function mapPartnerJob(item, feedUrl) {
  return {
    source: item.source || "Partner feed",
    externalId: item.id || item.externalId || item.reference || "",
    canonicalUrl: item.canonicalUrl || item.url || item.applyUrl || feedUrl,
    applyUrl: item.applyUrl || item.url || "",
    title: item.title,
    company: item.company || item.hiringOrganization || "",
    descriptionText: item.descriptionText || htmlToText(item.descriptionHtml || item.description || ""),
    locationText: item.locationText || item.location || "",
    workplaceType: item.workplaceType || "",
    employmentType: item.employmentType || "",
    salaryMin: item.salaryMin,
    salaryMax: item.salaryMax,
    salaryCurrency: item.salaryCurrency || "ZAR",
    postedAt: item.postedAt || item.datePosted || "",
    expiresAt: item.expiresAt || item.validThrough || "",
    category: item.category || "",
    rawPayload: item
  };
}
