import { defineHandler } from "nitro";
import { createError, getRequestHeader, getRequestURL } from "nitro/h3";
import { getSessionFromCookie, NeonAuthUnavailableError, type Session } from "../utils/session";

export default defineHandler(async event => {
  const url = getRequestURL(event);
  if (!url.pathname.startsWith("/api/admin/")) return;
  let session: Session;
  try {
    session = await getSessionFromCookie(getRequestHeader(event, "cookie") ?? null, url.protocol === "http:");
  } catch (error) {
    if (error instanceof NeonAuthUnavailableError) {
      throw createError({ statusCode: 503, statusMessage: error.message });
    }
    throw error;
  }
  if (!session?.user || !session.user.emailVerified) {
    throw createError({ statusCode: 401, statusMessage: "A verified administrator session is required." });
  }
  const allowedEmails = (process.env.NITRO_ADMIN_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  if (!allowedEmails.includes(session.user.email.toLowerCase())) {
    throw createError({ statusCode: 403, statusMessage: "Administrator access required." });
  }
  event.context.adminUserId = session.user.id;
});
