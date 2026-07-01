import { fetchJson } from "../../lib/fetch.js";
import { htmlToText } from "../../lib/text.js";

export function createLeverAdapter(companySlug) {
  return {
    id: `lever-${companySlug}`,
    name: `Lever ${companySlug}`,
    enabled: Boolean(companySlug),
    async fetchJobs() {
      if (!companySlug) return [];
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(companySlug)}?mode=json`;
      const data = await fetchJson(url);
      return (Array.isArray(data) ? data : []).map((item) => mapLeverJob(item, companySlug));
    }
  };
}

function mapLeverJob(item, companySlug) {
  const categories = item.categories || {};
  const lists = Array.isArray(item.lists) ? item.lists : [];
  const listText = lists.map((list) => `${list.text || ""}\n${list.content || ""}`).join("\n");
  return {
    source: `Lever:${companySlug}`,
    externalId: item.id,
    canonicalUrl: item.hostedUrl || item.applyUrl,
    applyUrl: item.applyUrl || item.hostedUrl,
    title: item.text,
    company: companySlug,
    descriptionText: htmlToText(`${item.description || ""}\n${listText}`),
    locationText: categories.location || (item.workplaceType === "remote" ? "Remote" : ""),
    workplaceType: item.workplaceType || "",
    employmentType: categories.commitment || "",
    postedAt: item.createdAt ? new Date(item.createdAt).toISOString() : "",
    expiresAt: "",
    category: [categories.team, categories.department].filter(Boolean).join(", "),
    rawPayload: item
  };
}
