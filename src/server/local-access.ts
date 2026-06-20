import { NextResponse } from "next/server";

function readEnv(name: string): string | undefined {
  if (typeof Bun !== "undefined") {return Bun.env[name];}
  return process.env[name];
}

const defaultAllowedHosts = ["127.0.0.1", "::1", "[::1]", "localhost"];

function normalizeHost(value: string): string {
  if (value.startsWith("[")) { const ci = value.indexOf("]"); return ci >= 0 ? value.slice(0, ci + 1) : value; }
  return value.split(":")[0];
}

function getAllowedHosts(): Set<string> {
  const configured = readEnv("LOCAL_ALLOWED_HOSTS");
  if (!configured) {return new Set(defaultAllowedHosts);}
  return new Set(configured.split(",").map((p) => p.trim()).filter(Boolean).map((p) => normalizeHost(p)));
}

function isAllowedHost(host: string | null): boolean {
  return host ? getAllowedHosts().has(normalizeHost(host)) : false;
}

function extractUrlHost(value: string | null): string | null {
  if (!value) {return null;}
  try { return new URL(value).hostname; } catch { return null; }
}

/** Checks if a request originates from an allowed local host, returning an error message if not. */
export function getLocalAccessError(request: Request): string | null {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
  if (!isAllowedHost(host)) {return "Local access only: this dashboard accepts requests from localhost hosts only.";}
  const originHost = extractUrlHost(request.headers.get("origin"));
  if (originHost && !isAllowedHost(originHost)) {return "Blocked cross-origin request: origin must resolve to localhost.";}
  const refererHost = extractUrlHost(request.headers.get("referer"));
  if (refererHost && !isAllowedHost(refererHost)) {return "Blocked cross-origin request: referer must resolve to localhost.";}
  return null;
}

/** Returns a 403 JSON response for local access violations. */
export function localAccessDeniedResponse(message: string): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status: 403 });
}
