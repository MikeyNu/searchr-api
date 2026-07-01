import { clean, lower, splitSentences, unique, words } from "../lib/text.js";

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

const skillTerms = [
  "administration", "appointment setting", "bookkeeping", "cash handling", "cleaning",
  "communication", "customer service", "data capture", "dispatch", "email", "excel",
  "filing", "forklift", "front desk", "inventory", "invoicing", "merchandising",
  "microsoft office", "operations", "packing", "payments", "phone etiquette", "pos",
  "reception", "reporting", "sales", "stock control", "supervision", "team support",
  "time management", "warehouse", "word"
];

const scamTerms = [
  "pay a fee", "registration fee", "training fee", "deposit", "whatsapp only",
  "send money", "no interview", "same day approval", "bank pin", "id before interview"
];

export function candidateProfile(cv) {
  const experience = Array.isArray(cv?.experience) ? cv.experience : [];
  const education = Array.isArray(cv?.education) ? cv.education : [];
  const skills = Array.isArray(cv?.skills) ? cv.skills : [];
  const languages = Array.isArray(cv?.languages) ? cv.languages : [];
  const responsibilities = experience.flatMap((item) => Array.isArray(item.responsibilities) ? item.responsibilities : []);
  const text = [
    cv?.summary,
    cv?.contact?.location,
    ...skills,
    ...languages,
    ...education.flatMap((item) => [item.institution, item.qualification, item.details]),
    ...experience.flatMap((item) => [item.company, item.role, item.startDate, item.endDate]),
    ...responsibilities
  ].join(" ");
  const yearsByRole = {};
  experience.forEach((item) => {
    const role = clean(item.role) || "Experience";
    yearsByRole[role] = (yearsByRole[role] || 0) + yearsBetween(item.startDate, item.endDate);
  });
  return {
    titles: unique(experience.map((item) => item.role)),
    industries: domainTerms.filter((term) => lower(text).includes(term)),
    skills: unique([...skills, ...skillTerms.filter((term) => lower(text).includes(term))]),
    tools: skillTerms.filter((term) => ["excel", "word", "microsoft office", "pos", "email"].includes(term) && lower(text).includes(term)),
    languages: unique(languages),
    education: unique(education.flatMap((item) => [item.qualification, item.details])),
    certifications: unique(education.flatMap((item) => {
      const line = `${item.qualification || ""} ${item.details || ""}`;
      return /(certificate|certification|licen[cs]e|grade|matric|diploma|degree|first aid|driver)/i.test(line) ? [line] : [];
    })),
    experienceYearsByRole: yearsByRole,
    responsibilities: unique(responsibilities),
    achievements: unique(responsibilities.filter((line) => /\d|improved|increased|reduced|trained|led/i.test(line))),
    location: clean(cv?.contact?.location),
    preferredLocations: cityTerms.filter((city) => lower(cv?.contact?.location).includes(city)),
    text
  };
}

export function scoreJob(cv, job) {
  const candidate = candidateProfile(cv);
  const jobProfile = normalizeJobProfile(job);
  const candidateSkills = new Set(candidate.skills.map(lower));
  const matched = jobProfile.requiredSkills.filter((skill) => candidateSkills.has(lower(skill)));
  const missing = jobProfile.requiredSkills.filter((skill) => !candidateSkills.has(lower(skill)));
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
      ...missing.slice(0, 4).map((skill) => `Show ${skill} only if it is true.`),
      ...(matched.length ? [`Move ${matched[0]} near the top of your skills.`] : ["Strengthen your summary for this role."])
    ]).slice(0, 6),
    components: { S, M, T, X, L, D, F, eligibility: gate.factor },
    job: jobProfile
  };
}

export function buildApplicationKit(cv, job, match = scoreJob(cv, job)) {
  const candidate = candidateProfile(cv);
  const name = clean(cv?.contact?.fullName) || "Candidate";
  const topSkills = unique([...match.matched, ...(Array.isArray(cv.skills) ? cv.skills : [])]).slice(0, 8);
  const proof = unique([
    clean(cv?.summary),
    ...candidate.responsibilities.filter((line) => match.matched.some((skill) => lower(line).includes(lower(skill))))
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
      ...match.missing.slice(0, 3).map((item) => `Do not claim ${item} unless you can prove it.`)
    ])
  };
}

function normalizeJobProfile(job) {
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

function yearsBetween(startDate, endDate) {
  const start = Number(String(startDate || "").match(/\b(19|20)\d{2}\b/)?.[0]);
  const endMatch = String(endDate || "").match(/\b(19|20)\d{2}\b/)?.[0];
  const end = endMatch ? Number(endMatch) : new Date().getFullYear();
  if (!start || end < start) return 0;
  return Math.max(1, end - start);
}

function ratio(matches, total) {
  if (!total) return 0.65;
  return clamp(matches / total, 0, 1);
}

function overlapScore(left, right) {
  const a = new Set(words(left).slice(0, 160));
  const b = new Set(words(right).slice(0, 220));
  if (!a.size || !b.size) return 0.45;
  let matches = 0;
  b.forEach((word) => {
    if (a.has(word)) matches += 1;
  });
  return clamp(matches / Math.min(b.size, 44), 0, 1);
}

function titleScore(candidate, job) {
  if (!candidate.titles.length) return 0.45;
  const best = candidate.titles.reduce((score, title) => Math.max(score, overlapScore(title, job.title)), 0);
  const domainHit = job.requiredSkills.some((skill) => candidate.skills.map(lower).includes(lower(skill))) ? 0.18 : 0;
  return clamp(best + domainHit, 0, 1);
}

function experienceScore(candidate, job) {
  const required = job.requiredExperienceYears;
  const years = Object.values(candidate.experienceYearsByRole).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!required) return years ? 0.78 : 0.55;
  return clamp(years / required, 0, 1);
}

function locationScore(candidate, job) {
  const jobLocation = lower(job.location);
  const candidateLocation = lower(candidate.location);
  if (!jobLocation || job.workplaceType === "remote") return 0.8;
  if (candidateLocation && (candidateLocation.includes(jobLocation) || jobLocation.includes(candidateLocation))) return 1;
  if (cityTerms.some((city) => candidateLocation.includes(city) && jobLocation.includes(city))) return 0.85;
  if (job.workplaceType === "hybrid") return 0.58;
  return 0.38;
}

function freshnessScore(job) {
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

function eligibility(candidate, job) {
  const blockers = [];
  const recommendations = [];
  const candidateText = lower(candidate.text);
  job.certifications.forEach((cert) => {
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
  job.requiredSkills.forEach((skill) => {
    if (!candidate.skills.map(lower).includes(lower(skill))) {
      recommendations.push(`Add evidence for ${skill} if you have it.`);
    }
  });
  return { factor: blockers.length ? 0.55 : 1, blockers, recommendations };
}

function bucket(score) {
  if (score >= 85) return "Excellent match";
  if (score >= 70) return "Strong match";
  if (score >= 55) return "Possible match";
  if (score >= 35) return "Stretch";
  return "Explore";
}

function applicationQuestions(text) {
  const parts = String(text || "").split("?");
  return parts.slice(0, -1)
    .map((part) => `${part.split(/(?:\.|!|\n)+/).pop()}?`)
    .map(clean)
    .filter((line) => line.endsWith("?"))
    .filter((line) => line.length > 4)
    .slice(0, 8);
}

function answerQuestion(question, cv, match, candidate) {
  const q = lower(question);
  if (q.includes("salary")) return "Discuss during interview.";
  if (q.includes("notice") || q.includes("start")) return "Available on request.";
  if (q.includes("location")) return clean(cv?.contact?.location) || "Location available on request.";
  if (q.includes("experience")) return candidate.responsibilities[0] || clean(cv?.summary) || "Relevant experience is shown in my CV.";
  if (q.includes("skill") || q.includes("strength")) return unique([...match.matched, ...(cv.skills || [])]).slice(0, 4).join(", ");
  return "See CV. Review before submitting.";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
