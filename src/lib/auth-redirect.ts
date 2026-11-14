const allowedRedirects = new Set(["/", "/admin/orders"]);

export function safeAuthRedirect(value: string | null | undefined, fallback = "/admin/orders") {
  if (!value) return fallback;
  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin || !allowedRedirects.has(target.pathname)) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function emailVerificationCallback(email: string, redirectTo = "/admin/orders") {
  const callback = new URL("/auth/verify-email", window.location.origin);
  callback.searchParams.set("email", email.trim());
  callback.searchParams.set("redirectTo", safeAuthRedirect(redirectTo));
  return callback.toString();
}
