export function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    const invalid = new Error("Invalid JSON body.");
    invalid.statusCode = 400;
    throw invalid;
  }
}

export function notFound(res, headers = {}) {
  sendJson(res, 404, { error: "Not found" }, headers);
}

export function methodNotAllowed(res, headers = {}) {
  sendJson(res, 405, { error: "Method not allowed" }, headers);
}
