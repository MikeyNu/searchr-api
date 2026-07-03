import { fetchJson } from "../../lib/fetch.js";
import { htmlToText } from "../../lib/text.js";

export function createLeverAdapter(companySlug) {
  const token = normalizeLeverCompanyToken(companySlug);
  const key = sourceKey(token);
  return {
    id: `lever-${key}`,
    name: `Lever ${token}`,
    enabled: Boolean(token),
    async fetchJobs() {
      if (!token) return [];
      const data = await fetchLeverPostings(token);
      return (Array.isArray(data) ? data : []).map((item) => mapLeverJob(item, token));
    }
  };
}

async function fetchLeverPostings(token) {
  const hosts = [
    "https://api.lever.co",
    "https://api.eu.lever.co"
  ];
  let emptyResult = null;
  let lastError = null;
  for (const host of hosts) {
    const url = `${host}/v0/postings/${encodeURIComponent(token)}?mode=json`;
    try {
      const data = await fetchJson(url);
      if (!Array.isArray(data)) continue;
      if (data.length) return data;
      emptyResult = data;
    } catch (error) {
      lastError = error;
    }
  }
  if (emptyResult) return emptyResult;
  if (lastError) throw lastError;
  return [];
}

function normalizeLeverCompanyToken(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!text.includes("://") && !text.includes("/")) return decodeToken(text);
  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    const parts = url.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    return decodeToken(parts[0] || text);
  } catch (_error) {
    return decodeToken(text.split(/[/?#]/).filter(Boolean).pop() || text);
  }
}

function decodeToken(value) {
  try {
    return decodeURIComponent(String(value || "").trim());
  } catch (_error) {
    return String(value || "").trim();
  }
}

function sourceKey(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return key || "company";
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
