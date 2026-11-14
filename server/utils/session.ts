import { neonAuthBaseUrl } from "./auth-config";

function restoreUpstreamCookieName(name: string) {
  if (name.startsWith("__Secure_")) return `__Secure-${name.slice("__Secure_".length)}`;
  if (name.startsWith("__Host_")) return `__Host-${name.slice("__Host_".length)}`;
  return name;
}

export function normalizeAuthCookieHeader(cookieHeader: string, isHttp: boolean): string {
  const parts = cookieHeader.split(";").map(part => part.trim()).filter(Boolean);
  const normalized: string[] = [];
  const seenPreviewCookieNames = new Set<string>();
  for (const part of parts) {
    const separator = part.indexOf("=");
    const name = (separator === -1 ? part : part.slice(0, separator)).trim();
    const value = separator === -1 ? "" : part.slice(separator + 1);
    const isPreviewCookie = name.startsWith("__Secure_") || name.startsWith("__Host_");
    const isSecureCookie = name.startsWith("__Secure-") || name.startsWith("__Host-");
    if (isHttp) {
      if (isSecureCookie) continue;
      if (isPreviewCookie) {
        const restoredName = restoreUpstreamCookieName(name);
        if (seenPreviewCookieNames.has(restoredName)) continue;
        seenPreviewCookieNames.add(restoredName);
        normalized.push(`${restoredName}=${value}`);
        continue;
      }
    } else if (isPreviewCookie) continue;
    normalized.push(`${name}=${value}`);
  }
  return normalized.join("; ");
}

type AuthUserResponse = { id?: unknown; name?: unknown; email?: unknown; emailVerified?: unknown; email_verified?: unknown };
type AuthSessionResponse = { user?: AuthUserResponse } | null;

export type Session = { user: { id: string; name: string; email: string; emailVerified: boolean } } | null;

export class NeonAuthUnavailableError extends Error {
  constructor() {
    super("Neon Auth is not configured or is currently unavailable.");
    this.name = "NeonAuthUnavailableError";
  }
}

export async function getSessionFromCookie(cookieHeader: string | null, isHttp: boolean): Promise<Session> {
  if (!neonAuthBaseUrl) throw new NeonAuthUnavailableError();
  if (!cookieHeader) return null;
  const cookie = normalizeAuthCookieHeader(cookieHeader, isHttp);
  if (!cookie) return null;
  let response: Response;
  try {
    response = await fetch(`${neonAuthBaseUrl}/get-session?disableCookieCache=true`, { headers: { cookie }, cache: "no-store" });
  } catch {
    throw new NeonAuthUnavailableError();
  }
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new NeonAuthUnavailableError();
  const session = await response.json() as AuthSessionResponse;
  const user = session?.user;
  if (typeof user?.id !== "string" || typeof user.email !== "string") return null;
  return {
    user: {
      id: user.id,
      name: typeof user.name === "string" ? user.name : "",
      email: user.email,
      emailVerified: user.emailVerified === true || user.email_verified === true,
    },
  };
}
