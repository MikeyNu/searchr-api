import { fetchJson } from "../../lib/fetch.js";
import { htmlToText } from "../../lib/text.js";

export function createGreenhouseAdapter(boardToken) {
  const token = normalizeGreenhouseBoardToken(boardToken);
  return {
    id: `greenhouse-${token}`,
    name: `Greenhouse ${token}`,
    enabled: Boolean(token),
    async fetchJobs() {
      if (!token) return [];
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
      const data = await fetchJson(url);
      return (data.jobs || []).map((item) => mapGreenhouseJob(item, token));
    }
  };
}

function normalizeGreenhouseBoardToken(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!text.includes("://") && !text.includes("/")) return text;
  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    const parts = url.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    const boardIndex = parts.indexOf("boards");
    if (boardIndex >= 0 && parts[boardIndex + 1]) return parts[boardIndex + 1];
    const jobsIndex = parts.indexOf("jobs");
    if (jobsIndex > 0) return parts[jobsIndex - 1];
    return parts[0] || text;
  } catch (_error) {
    return text.split("/").filter(Boolean)[0] || text;
  }
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
