import { defineHandler } from "nitro";
import { getRequestHeaders, getRequestURL, readRawBody } from "nitro/h3";
import { normalizeAuthCookieHeader } from "../../../utils/session";

const neonAuthBaseUrl = process.env.NEON_AUTH_BASE_URL;
const FORWARDED_REQUEST_HEADERS = new Set([
  "accept", "accept-language", "authorization", "content-type", "cookie", "origin", "referer", "user-agent", "x-forwarded-for",
]);

export default defineHandler(async event => {
  if (!neonAuthBaseUrl) {
    return new Response(JSON.stringify({ message: "Neon Auth is not configured on this server." }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  const url = getRequestURL(event);
  const upstreamPath = url.pathname.startsWith("/api/auth") ? url.pathname.slice("/api/auth".length) || "/" : url.pathname;
  const forwardedHeaders = new Headers();
  const incomingHeaders = getRequestHeaders(event);
  for (const [key, value] of Object.entries(incomingHeaders)) {
    const headerName = key.toLowerCase();
    if (!value || !FORWARDED_REQUEST_HEADERS.has(headerName)) continue;
    forwardedHeaders.set(headerName, value);
  }
  const cookieHeader = forwardedHeaders.get("cookie");
  if (cookieHeader) {
    const normalizedCookie = normalizeAuthCookieHeader(cookieHeader, url.protocol === "http:");
    if (normalizedCookie) forwardedHeaders.set("cookie", normalizedCookie);
    else forwardedHeaders.delete("cookie");
  }
  const body = event.method === "GET" || event.method === "HEAD" ? undefined : await readRawBody(event, false);
  const upstream = await fetch(`${neonAuthBaseUrl}${upstreamPath}${url.search}`, {
    method: event.method,
    headers: forwardedHeaders,
    body: body as BodyInit | undefined,
    redirect: "manual",
  });
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => { if (key.toLowerCase() !== "set-cookie") responseHeaders.append(key, value); });
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = getSetCookie?.call(upstream.headers) ?? [];
  for (let cookie of cookies) {
    if (url.protocol === "http:") {
      cookie = cookie.replaceAll("__Secure-", "__Secure_").replaceAll("__Host-", "__Host_");
      cookie = cookie.replaceAll("; Secure", "").replaceAll(";Secure", "").replaceAll("; Partitioned", "").replaceAll(";Partitioned", "");
      cookie = cookie.replace(/;[ ]*Domain=[^;]*/gi, "");
      cookie = cookie.replaceAll("; SameSite=None", "; SameSite=Lax").replaceAll(";SameSite=None", ";SameSite=Lax");
    }
    responseHeaders.append("set-cookie", cookie);
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
});
