import { fetchJson } from "../../lib/fetch.js";
import { htmlToText } from "../../lib/text.js";

export function createGreenhouseAdapter(boardToken) {
  return {
    id: `greenhouse-${boardToken}`,
    name: `Greenhouse ${boardToken}`,
    enabled: Boolean(boardToken),
    async fetchJobs() {
      if (!boardToken) return [];
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
      const data = await fetchJson(url);
      return (data.jobs || []).map((item) => mapGreenhouseJob(item, boardToken));
    }
  };
}

function mapGreenhouseJob(item, boardToken) {
  const offices = (item.offices || []).map((office) => office.name).filter(Boolean);
  const departments = (item.departments || []).map((department) => department.name).filter(Boolean);
  return {
    source: `Greenhouse:${boardToken}`,
    externalId: item.id,
    canonicalUrl: item.absolute_url,
    applyUrl: item.absolute_url,
    title: item.title,
    company: boardToken,
    descriptionText: htmlToText(item.content || ""),
    locationText: offices.join(", "),
    workplaceType: "",
    employmentType: "",
    postedAt: item.updated_at,
    expiresAt: "",
    category: departments.join(", "),
    rawPayload: item
  };
}
