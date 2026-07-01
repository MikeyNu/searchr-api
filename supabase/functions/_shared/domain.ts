export type AnyRecord = Record<string, any>;

export type SourceAdapter = {
  id: string;
  name: string;
  enabled: boolean;
  fetchJobs: () => Promise<AnyRecord[]>;
};

const skillTerms = [
  "administration", "appointment setting", "bookkeeping", "cash handling", "cleaning",
  "communication", "customer service", "data capture", "dispatch", "email", "excel",
  "filing", "forklift", "front desk", "inventory", "invoicing", "merchandising",
  "microsoft office", "operations", "packing", "payments", "phone etiquette", "pos",
  "reception", "reporting", "sales", "stock control", "supervision", "team support",
  "time management", "warehouse", "word"
];

const domainTerms = [
  "admin", "beauty", "cafe", "call centre", "customer", "education", "field",
  "finance", "hospitality", "it", "logistics", "office", "operations", "reception",
  "restaurant", "retail", "sales", "service", "shop", "store", "technical",
  "warehouse", "wellness"
];

const cityTerms = [
  "johannesburg", "pretoria", "cape town", "durban", "gqeberha", "port elizabeth",
  "bloemfontein", "polokwane", "nelspruit", "mbombela", "kimberley", "rustenburg",
  "soweto", "sandton", "midrand", "centurion", "stellenbosch", "remote"
];

const scamTerms = [
  "pay a fee", "registration fee", "training fee", "deposit", "whatsapp only",
  "send money", "no interview", "same day approval", "bank pin", "id before interview"
];

export function clean(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

export function unique(items: unknown[]): string[] {
  const seen = new Set<string>();
  return items
    .map(clean)
    .filter(Boolean)
    .filter((item) => {
      const key = lower(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function words(value: unknown): string[] {
  return lower(value)
    .replace(/[^a-z0-9\s+-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export function htmlToText(html: unknown): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>|<\/h[1-6]>|<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export function stableHash(value: unknown): string {
  const text = lower(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const left = (h2 >>> 0).toString(16).padStart(8, "0");
  const right = (h1 >>> 0).toString(16).padStart(8, "0");
  return `${left}${right}`;
}

export function slug(value: unknown): string {
  const result = lower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return result || "item";
}

export function splitSentences(text: unknown): string[] {
  return clean(text)
    .split(/(?:\.|\n|;|\u2022|- )+/)
    .map(clean)
    .filter((line) => line.length > 8)
    .slice(0, 20);
}

export function normalizeJob(raw: AnyRecord): AnyRecord {
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

export function normalizeMany(items: unknown): AnyRecord[] {
  return (Array.isArray(items) ? items : []).map((item) => normalizeJob(item as AnyRecord)).filter((job) => job.title && job.descriptionText);
}

function extractRequirements(text: string): AnyRecord {
  const source = clean(text).toLowerCase();
  const skills = skillTerms.filter((skill) => source.includes(skill));
  const education: string[] = [];
  const certifications: string[] = [];
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

function normalizeWorkplace(value: unknown): string {
  const source = clean(value).toLowerCase();
  if (source.includes("hybrid")) return "hybrid";
  if (source.includes("remote") || source.includes("work from home")) return "remote";
  if (source.includes("onsite") || source.includes("on-site") || source.includes("site based")) return "onsite";
  return "";
}

function inferEmploymentType(text: string): string {
  const source = clean(text).toLowerCase();
  if (source.includes("part-time") || source.includes("part time")) return "Part-time";
  if (source.includes("contract")) return "Contract";
  if (source.includes("learnership")) return "Learnership";
  if (source.includes("internship")) return "Internship";
  if (source.includes("full-time") || source.includes("full time")) return "Full-time";
  return "";
}

function normalizeDate(value: unknown): string {
  const text = clean(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function candidateProfile(cv: AnyRecord): AnyRecord {
  const experience = Array.isArray(cv?.experience) ? cv.experience : [];
  const education = Array.isArray(cv?.education) ? cv.education : [];
  const skills = Array.isArray(cv?.skills) ? cv.skills : [];
  const languages = Array.isArray(cv?.languages) ? cv.languages : [];
  const responsibilities = experience.flatMap((item: AnyRecord) => Array.isArray(item.responsibilities) ? item.responsibilities : []);
  const text = [
    cv?.summary,
    cv?.contact?.location,
    ...skills,
    ...languages,
    ...education.flatMap((item: AnyRecord) => [item.institution, item.qualification, item.details]),
    ...experience.flatMap((item: AnyRecord) => [item.company, item.role, item.startDate, item.endDate]),
    ...responsibilities
  ].join(" ");
  const yearsByRole: AnyRecord = {};
  experience.forEach((item: AnyRecord) => {
    const role = clean(item.role) || "Experience";
    yearsByRole[role] = (yearsByRole[role] || 0) + yearsBetween(item.startDate, item.endDate);
  });
  return {
    titles: unique(experience.map((item: AnyRecord) => item.role)),
    industries: domainTerms.filter((term) => lower(text).includes(term)),
    skills: unique([...skills, ...skillTerms.filter((term) => lower(text).includes(term))]),
    tools: skillTerms.filter((term) => ["excel", "word", "microsoft office", "pos", "email"].includes(term) && lower(text).includes(term)),
    languages: unique(languages),
    education: unique(education.flatMap((item: AnyRecord) => [item.qualification, item.details])),
    certifications: unique(education.flatMap((item: AnyRecord) => {
      const line = `${item.qualification || ""} ${item.details || ""}`;
      return /(certificate|certification|licen[cs]e|grade|matric|diploma|degree|first aid|driver)/i.test(line) ? [line] : [];
    })),
    experienceYearsByRole: yearsByRole,
    responsibilities: unique(responsibilities),
    achievements: unique(responsibilities.filter((line: string) => /\d|improved|increased|reduced|trained|led/i.test(line))),
    location: clean(cv?.contact?.location),
    preferredLocations: cityTerms.filter((city) => lower(cv?.contact?.location).includes(city)),
    text
  };
}

export function scoreJob(cv: AnyRecord, job: AnyRecord): AnyRecord {
  const candidate = candidateProfile(cv);
  const jobProfile = normalizeJobProfile(job);
  const candidateSkills = new Set(candidate.skills.map(lower));
  const matched = jobProfile.requiredSkills.filter((skill: string) => candidateSkills.has(lower(skill)));
  const missing = jobProfile.requiredSkills.filter((skill: string) => !candidateSkills.has(lower(skill)));
  const S = ratio(matched.length, jobProfile.requiredSkills.length);
  const M = overlapScore(candidate.text, jobProfile.text);
  const T = titleScore(candidate, jobProfile);
  const X = experienceScore(candidate, jobProfile);
  const L = locationScore(candidate, jobProfile);
  const D = overlapScore(candidate.industries.join(" "), `${jobProfile.title} ${jobProfile.text}`);
  const F = freshnessScore(jobProfile);
  const gate = eligibility(candidate, jobProfile);
  const score = Math.round(gate.factor * 100 * (0.30 * S + 0.20 * M + 0.15 * T + 0.10 * X + 0.10 * L + 0.10 * D + 0.05 * F));
  return {
    score: clamp(score, 0, 100),
    bucket: bucket(score),
    matched: matched.slice(0, 8),
    missing: missing.slice(0, 8),
    blockers: gate.blockers,
    recommendations: unique([
      ...gate.recommendations,
      ...missing.slice(0, 4).map((skill: string) => `Show ${skill} only if it is true.`),
      ...(matched.length ? [`Move ${matched[0]} near the top of your skills.`] : ["Strengthen your summary for this role."])
    ]).slice(0, 6),
    components: { S, M, T, X, L, D, F, eligibility: gate.factor },
    job: jobProfile
  };
}

export function buildApplicationKit(cv: AnyRecord, job: AnyRecord, match = scoreJob(cv, job)): AnyRecord {
  const candidate = candidateProfile(cv);
  const name = clean(cv?.contact?.fullName) || "Candidate";
  const topSkills = unique([...match.matched, ...(Array.isArray(cv.skills) ? cv.skills : [])]).slice(0, 8);
  const proof = unique([
    clean(cv?.summary),
    ...candidate.responsibilities.filter((line: string) => match.matched.some((skill: string) => lower(line).includes(lower(skill))))
  ]).filter(Boolean).slice(0, 4);
  const title = clean(job.title) || "the role";
  const company = clean(job.company);
  const coverLetter = [
    "Dear hiring team,",
    "",
    `I am applying for ${company ? `${title} at ${company}` : title}. My CV shows relevant experience in ${topSkills.slice(0, 3).join(", ") || "the listed duties"}.`,
    proof.length ? `Relevant evidence: ${proof.join(" ")}` : "My CV is focused on the advert requirements.",
    match.missing.length ? `Before applying, I will review these gaps: ${match.missing.join(", ")}.` : "The role aligns well with my current CV.",
    "",
    "Kind regards,",
    name
  ].join("\n");
  const questions = applicationQuestions(job.descriptionText).map((question) => ({
    question,
    answer: answerQuestion(question, cv, match, candidate)
  }));
  return {
    jobId: job.id,
    createdAt: new Date().toISOString(),
    summary: `${name} is a fit for ${title}. ${topSkills.length ? `Relevant strengths: ${topSkills.slice(0, 4).join(", ")}.` : ""}`.trim(),
    skills: topSkills,
    coverLetter,
    answers: questions,
    checklist: unique([
      "Review the tailored summary.",
      "Export the latest CV as PDF.",
      job.applyUrl ? "Open the employer apply link." : "Confirm the employer apply link.",
      ...match.blockers,
      ...match.missing.slice(0, 3).map((item: string) => `Do not claim ${item} unless you can prove it.`)
    ])
  };
}

function normalizeJobProfile(job: AnyRecord): AnyRecord {
  const text = [
    job.title,
    job.company,
    job.locationText,
    job.workplaceType,
    job.employmentType,
    job.category,
    job.descriptionText
  ].join(" ");
  const requiredSkills = unique([...(job.requirements?.skills || []), ...skillTerms.filter((term) => lower(text).includes(term))]);
  return {
    title: clean(job.title),
    company: clean(job.company),
    requiredSkills,
    responsibilities: splitSentences(job.descriptionText),
    requiredExperienceYears: job.requirements?.requiredExperienceYears || null,
    educationRequirements: job.requirements?.education || [],
    certifications: job.requirements?.certifications || [],
    location: clean(job.locationText),
    workplaceType: clean(job.workplaceType),
    employmentType: clean(job.employmentType),
    applyUrl: clean(job.applyUrl),
    source: clean(job.source),
    postedAt: clean(job.postedAt),
    expiresAt: clean(job.expiresAt),
    text
  };
}

function yearsBetween(startDate: unknown, endDate: unknown): number {
  const start = Number(String(startDate || "").match(/\b(19|20)\d{2}\b/)?.[0]);
  const endMatch = String(endDate || "").match(/\b(19|20)\d{2}\b/)?.[0];
  const end = endMatch ? Number(endMatch) : new Date().getFullYear();
  if (!start || end < start) return 0;
  return Math.max(1, end - start);
}

function ratio(matches: number, total: number): number {
  if (!total) return 0.65;
  return clamp(matches / total, 0, 1);
}

function overlapScore(left: unknown, right: unknown): number {
  const a = new Set(words(left).slice(0, 160));
  const b = new Set(words(right).slice(0, 220));
  if (!a.size || !b.size) return 0.45;
  let matches = 0;
  b.forEach((word) => {
    if (a.has(word)) matches += 1;
  });
  return clamp(matches / Math.min(b.size, 44), 0, 1);
}

function titleScore(candidate: AnyRecord, job: AnyRecord): number {
  if (!candidate.titles.length) return 0.45;
  const best = candidate.titles.reduce((score: number, title: string) => Math.max(score, overlapScore(title, job.title)), 0);
  const domainHit = job.requiredSkills.some((skill: string) => candidate.skills.map(lower).includes(lower(skill))) ? 0.18 : 0;
  return clamp(best + domainHit, 0, 1);
}

function experienceScore(candidate: AnyRecord, job: AnyRecord): number {
  const required = job.requiredExperienceYears;
  const years = Object.values(candidate.experienceYearsByRole).reduce((sum: number, value: any) => sum + Number(value || 0), 0);
  if (!required) return years ? 0.78 : 0.55;
  return clamp(years / required, 0, 1);
}

function locationScore(candidate: AnyRecord, job: AnyRecord): number {
  const jobLocation = lower(job.location);
  const candidateLocation = lower(candidate.location);
  if (!jobLocation || job.workplaceType === "remote") return 0.8;
  if (candidateLocation && (candidateLocation.includes(jobLocation) || jobLocation.includes(candidateLocation))) return 1;
  if (cityTerms.some((city) => candidateLocation.includes(city) && jobLocation.includes(city))) return 0.85;
  if (job.workplaceType === "hybrid") return 0.58;
  return 0.38;
}

function freshnessScore(job: AnyRecord): number {
  let score = 0.58;
  if (job.applyUrl) score += 0.16;
  if (job.source) score += 0.1;
  if (job.postedAt) {
    const posted = Date.parse(job.postedAt);
    if (!Number.isNaN(posted)) {
      const days = (Date.now() - posted) / 86400000;
      score += days <= 14 ? 0.16 : days <= 45 ? 0.08 : 0;
    }
  }
  if (job.expiresAt) {
    const expires = Date.parse(job.expiresAt);
    if (!Number.isNaN(expires) && expires < Date.now()) score -= 0.35;
  }
  return clamp(score, 0, 1);
}

function eligibility(candidate: AnyRecord, job: AnyRecord): AnyRecord {
  const blockers: string[] = [];
  const recommendations: string[] = [];
  const candidateText = lower(candidate.text);
  job.certifications.forEach((cert: string) => {
    if (!candidateText.includes(lower(cert).replace("'s", ""))) {
      blockers.push(`Requires ${cert}.`);
    }
  });
  if (/must be based in|only candidates in|own transport required/.test(lower(job.text)) && locationScore(candidate, job) < 0.7) {
    blockers.push("Location requirement mismatch.");
  }
  if (scamTerms.some((term) => lower(job.text).includes(term))) {
    blockers.push("Posting has payment or trust risk.");
  }
  job.requiredSkills.forEach((skill: string) => {
    if (!candidate.skills.map(lower).includes(lower(skill))) {
      recommendations.push(`Add evidence for ${skill} if you have it.`);
    }
  });
  return { factor: blockers.length ? 0.55 : 1, blockers, recommendations };
}

function bucket(score: number): string {
  if (score >= 85) return "Excellent match";
  if (score >= 70) return "Strong match";
  if (score >= 55) return "Possible match";
  if (score >= 35) return "Stretch";
  return "Explore";
}

function applicationQuestions(text: unknown): string[] {
  const parts = String(text || "").split("?");
  return parts.slice(0, -1)
    .map((part) => `${part.split(/(?:\.|!|\n)+/).pop()}?`)
    .map(clean)
    .filter((line) => line.endsWith("?"))
    .filter((line) => line.length > 4)
    .slice(0, 8);
}

function answerQuestion(question: string, cv: AnyRecord, match: AnyRecord, candidate: AnyRecord): string {
  const q = lower(question);
  if (q.includes("salary")) return "Discuss during interview.";
  if (q.includes("notice") || q.includes("start")) return "Available on request.";
  if (q.includes("location")) return clean(cv?.contact?.location) || "Location available on request.";
  if (q.includes("experience")) return candidate.responsibilities[0] || clean(cv?.summary) || "Relevant experience is shown in my CV.";
  if (q.includes("skill") || q.includes("strength")) return unique([...match.matched, ...(cv.skills || [])]).slice(0, 4).join(", ");
  return "See CV. Review before submitting.";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function fetchJson(url: string, options: AnyRecord = {}): Promise<any> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      accept: "application/json",
      "user-agent": "SearchRJobsBot/0.1 (+https://searchr.local)",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_error) {
    throw new Error(`Expected JSON from ${url}`);
  }
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}: ${JSON.stringify(body).slice(0, 220)}`);
  }
  return body;
}

async function fetchWithTimeout(url: string, options: AnyRecord = {}): Promise<Response> {
  const timeoutMs = Number(options.timeoutMs || 20000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function list(value: unknown): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function int(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadSourceConfig(env: { get(name: string): string | undefined | null }): AnyRecord {
  return {
    adzuna: {
      appId: String(env.get("ADZUNA_APP_ID") || ""),
      appKey: String(env.get("ADZUNA_APP_KEY") || ""),
      queries: list(env.get("ADZUNA_QUERIES")),
      locations: list(env.get("ADZUNA_LOCATIONS")),
      resultsPerQuery: int(env.get("ADZUNA_RESULTS_PER_QUERY"), 20)
    },
    greenhouseBoards: list(env.get("GREENHOUSE_BOARDS")),
    leverCompanies: list(env.get("LEVER_COMPANIES")),
    partnerFeedUrls: list(env.get("PARTNER_FEED_URLS"))
  };
}

export function configuredSources(settings: AnyRecord): SourceAdapter[] {
  return [
    createAdzunaAdapter(settings.adzuna),
    ...settings.greenhouseBoards.map(createGreenhouseAdapter),
    ...settings.leverCompanies.map(createLeverAdapter),
    ...settings.partnerFeedUrls.map(createPartnerFeedAdapter)
  ];
}

function createAdzunaAdapter(settings: AnyRecord): SourceAdapter {
  return {
    id: "adzuna-za",
    name: "Adzuna South Africa",
    enabled: Boolean(settings.appId && settings.appKey),
    async fetchJobs() {
      if (!settings.appId || !settings.appKey) return [];
      const queries = settings.queries.length ? settings.queries : ["retail"];
      const locations = settings.locations.length ? settings.locations : ["South Africa"];
      const jobs: AnyRecord[] = [];
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
          for (const item of data.results || []) jobs.push(mapAdzunaJob(item));
        }
      }
      return jobs;
    }
  };
}

function mapAdzunaJob(item: AnyRecord): AnyRecord {
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
    salaryMin: item.salary_min ?? null,
    salaryMax: item.salary_max ?? null,
    salaryCurrency: "ZAR",
    postedAt: item.created,
    expiresAt: "",
    category: item.category?.label || "",
    rawPayload: item
  };
}

function createGreenhouseAdapter(boardToken: string): SourceAdapter {
  return {
    id: `greenhouse-${boardToken}`,
    name: `Greenhouse ${boardToken}`,
    enabled: Boolean(boardToken),
    async fetchJobs() {
      if (!boardToken) return [];
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
      const data = await fetchJson(url);
      return (data.jobs || []).map((item: AnyRecord) => mapGreenhouseJob(item, boardToken));
    }
  };
}

function mapGreenhouseJob(item: AnyRecord, boardToken: string): AnyRecord {
  const offices = (item.offices || []).map((office: AnyRecord) => office.name).filter(Boolean);
  const departments = (item.departments || []).map((department: AnyRecord) => department.name).filter(Boolean);
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

function createLeverAdapter(companySlug: string): SourceAdapter {
  return {
    id: `lever-${companySlug}`,
    name: `Lever ${companySlug}`,
    enabled: Boolean(companySlug),
    async fetchJobs() {
      if (!companySlug) return [];
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(companySlug)}?mode=json`;
      const data = await fetchJson(url);
      return (Array.isArray(data) ? data : []).map((item: AnyRecord) => mapLeverJob(item, companySlug));
    }
  };
}

function mapLeverJob(item: AnyRecord, companySlug: string): AnyRecord {
  const categories = item.categories || {};
  const lists = Array.isArray(item.lists) ? item.lists : [];
  const listText = lists.map((line: AnyRecord) => `${line.text || ""}\n${line.content || ""}`).join("\n");
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

function createPartnerFeedAdapter(feedUrl: string): SourceAdapter {
  return {
    id: `partner-${stableHash(feedUrl).slice(0, 24)}`,
    name: "Partner feed",
    enabled: Boolean(feedUrl),
    async fetchJobs() {
      if (!feedUrl) return [];
      const data = await fetchJson(feedUrl);
      const rows = Array.isArray(data) ? data : Array.isArray(data.jobs) ? data.jobs : [];
      return rows.map((item: AnyRecord) => mapPartnerJob(item, feedUrl));
    }
  };
}

function mapPartnerJob(item: AnyRecord, feedUrl: string): AnyRecord {
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
