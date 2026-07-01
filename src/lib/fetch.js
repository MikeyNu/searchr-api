export async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      accept: "application/json",
      "user-agent": "ScriptoryJobsBot/0.1 (+local development)",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`Expected JSON from ${url}`);
  }
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}: ${JSON.stringify(body).slice(0, 220)}`);
  }
  return body;
}

export async function fetchText(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      accept: "text/html,application/json",
      "user-agent": "ScriptoryJobsBot/0.1 (+local development)",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return text;
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 20000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
