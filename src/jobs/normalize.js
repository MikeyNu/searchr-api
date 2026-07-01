import { clean, htmlToText, stableHash, slug, unique } from "../lib/text.js";

const skillTerms = [
  "administration", "appointment setting", "bookkeeping", "cash handling", "cleaning",
  "communication", "customer service", "data capture", "dispatch", "email", "excel",
  "filing", "forklift", "front desk", "inventory", "invoicing", "merchandising",
  "microsoft office", "operations", "packing", "payments", "phone etiquette", "pos",
  "reception", "reporting", "sales", "stock control", "supervision", "team support",
  "time management", "warehouse", "word"
];

export function normalizeJob(raw) {
  const job = raw && typeof raw === "object" ? raw : {};
  const descriptionText = clean(job.descriptionText || htmlToText(job.descriptionHtml || job.description || ""));
  const title = clean(job.title);
  const company = clean(job.company);
  const location = clean(job.locationText || job.location);
  const source = clean(job.source);
  const canonicalUrl = clean(job.canonicalUrl || job.applyUrl || job.sourceUrl);
  const externalId = clean(job.externalId || stableHash(`${source}|${canonicalUrl}|${title}|${company}|${location}`)).slice(0, 40);
  const salaryMin = numberOrNull(job.salaryMin);
  const salaryMax = numberOrNull(job.salaryMax);
  const contentHash = stableHash([title, company, location, descriptionText, salaryMin, salaryMax].join("|"));
  const id = slug(`${source}-${externalId}-${title}-${company}`).slice(0, 180);
  return {
    id,
    source,
    externalId,
    canonicalUrl,
    applyUrl: clean(job.applyUrl || canonicalUrl),
    title,
    company,
    descriptionText,
    locationText: location,
    workplaceType: normalizeWorkplace(job.workplaceType || `${location} ${descriptionText}`),
    employmentType: clean(job.employmentType || inferEmploymentType(descriptionText)),
    salaryMin,
    salaryMax,
    salaryCurrency: clean(job.salaryCurrency || "ZAR"),
    postedAt: normalizeDate(job.postedAt),
    expiresAt: normalizeDate(job.expiresAt),
    status: clean(job.status || "active"),
    category: clean(job.category),
    requirements: extractRequirements(descriptionText),
    contentHash,
    rawPayload: job.rawPayload || job
  };
}

export function normalizeMany(items) {
  return (Array.isArray(items) ? items : []).map(normalizeJob).filter((job) => job.title && job.descriptionText);
}

function extractRequirements(text) {
  const source = clean(text).toLowerCase();
  const skills = skillTerms.filter((skill) => source.includes(skill));
  const education = [];
  const certifications = [];
  if (source.includes("matric") || source.includes("grade 12")) education.push("Matric or Grade 12");
  if (source.includes("diploma")) education.push("Diploma");
  if (source.includes("degree")) education.push("Degree");
  if (source.includes("driver") && source.includes("license")) certifications.push("Driver's license");
  if (source.includes("forklift")) certifications.push("Forklift certificate");
  if (source.includes("psira")) certifications.push("PSIRA registration");
  if (source.includes("first aid")) certifications.push("First aid certificate");
  const years = source.match(/(\d+)\+?\s*(?:years|yrs).{0,28}(?:experience|exp)/);
  return {
    skills: unique(skills),
    education: unique(education),
    certifications: unique(certifications),
    requiredExperienceYears: years ? Number(years[1]) : null
  };
}

function normalizeWorkplace(value) {
  const source = clean(value).toLowerCase();
  if (source.includes("hybrid")) return "hybrid";
  if (source.includes("remote") || source.includes("work from home")) return "remote";
  if (source.includes("onsite") || source.includes("on-site") || source.includes("site based")) return "onsite";
  return "";
}

function inferEmploymentType(text) {
  const source = clean(text).toLowerCase();
  if (source.includes("part-time") || source.includes("part time")) return "Part-time";
  if (source.includes("contract")) return "Contract";
  if (source.includes("learnership")) return "Learnership";
  if (source.includes("internship")) return "Internship";
  if (source.includes("full-time") || source.includes("full time")) return "Full-time";
  return "";
}

function normalizeDate(value) {
  const text = clean(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
