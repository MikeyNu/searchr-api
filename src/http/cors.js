import { config } from "../config.js";

export function corsHeaders(origin) {
  const allowed = config.allowedOrigins;
  const allowOrigin = !origin
    ? "*"
    : allowed.length === 0 || allowed.includes(origin)
      ? origin
      : allowed[0] || "*";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400"
  };
}
