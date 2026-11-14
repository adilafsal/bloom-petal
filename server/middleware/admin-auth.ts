import { defineHandler } from "nitro";
import { createError, getRequestHeader, getRequestURL } from "nitro/h3";
import { getSessionFromCookie, NeonAuthUnavailableError, normalizeAuthCookieHeader, type Session } from "../utils/session";

export default defineHandler(async event => {
  const url = getRequestURL(event);
  if (!url.pathname.startsWith("/api/admin/")) return;
  const isHttp = url.protocol === "http:";
  const cookieHeader = getRequestHeader(event, "cookie") ?? null;
  if (!cookieHeader || !normalizeAuthCookieHeader(cookieHeader, isHttp)) {
    throw createError({ statusCode: 401, statusMessage: "No valid Neon Auth session cookie reached the server. Sign in again and check that the browser accepts the session cookie." });
  }
  let session: Session;
  try {
    session = await getSessionFromCookie(cookieHeader, isHttp);
  } catch (error) {
    if (error instanceof NeonAuthUnavailableError) {
      throw createError({ statusCode: 503, statusMessage: error.message });
    }
    throw error;
  }
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: "Neon Auth rejected the session cookie. It may have expired; sign out and sign in again." });
  }
  if (!session.user.emailVerified) {
    throw createError({ statusCode: 403, statusMessage: "Verify this email address with Neon Auth before accessing the admin dashboard." });
  }
  const allowedEmails = (process.env.NITRO_ADMIN_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  if (!allowedEmails.length) {
    throw createError({ statusCode: 503, statusMessage: "NITRO_ADMIN_EMAILS is not configured on this server." });
  }
  if (!allowedEmails.includes(session.user.email.toLowerCase())) {
    throw createError({ statusCode: 403, statusMessage: "This verified account is not listed in NITRO_ADMIN_EMAILS." });
  }
  event.context.adminUserId = session.user.id;
});
