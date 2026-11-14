import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "../lib/auth-client";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { data, isPending } = useAuthSession();
  const navigate = useNavigate();
  const [state, setState] = useState<{ kind: "checking" } | { kind: "allowed" } | { kind: "denied"; message: string } | { kind: "error"; message: string }>({ kind: "checking" });

  useEffect(() => {
    if (isPending) return;
    if (!data?.user) {
      navigate("/auth/sign-in", { replace: true, state: { redirectTo: "/admin/orders" } });
      return;
    }
    let active = true;
    setState({ kind: "checking" });
    fetch("/api/admin/access", { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as { statusMessage?: string; message?: string };
        if (response.ok) return { kind: "allowed" as const };
        if (response.status === 401) {
          navigate("/auth/sign-in", { replace: true, state: { redirectTo: "/admin/orders" } });
          return { kind: "error" as const, message: "Your session expired. Sign in again to continue." };
        }
        return { kind: response.status === 403 ? "denied" as const : "error" as const, message: body.statusMessage || body.message || "Administrator access could not be verified." };
      })
      .then(result => {
        if (!active) return;
        if (result.kind === "denied" && /verify this email/i.test(result.message)) {
          navigate(`/auth/verify-email?email=${encodeURIComponent(data.user.email)}&redirectTo=%2Fadmin%2Forders`, { replace: true });
          return;
        }
        setState(result);
      })
      .catch(() => { if (active) setState({ kind: "error", message: "Administrator access could not be verified. Please try again." }); });
    return () => { active = false; };
  }, [data?.user?.id, data?.user?.email, isPending, navigate]);

  if (state.kind === "allowed") return children;
  if (state.kind === "denied") return <main className="admin-orders-state"><span className="eyebrow">ACCESS RESTRICTED</span><h1>Admin access <em>is unavailable.</em></h1><p>{state.message}</p></main>;
  if (state.kind === "error") return <main className="admin-orders-state"><span className="eyebrow">ADMIN ACCESS CHECK</span><h1>Could not verify access.</h1><p role="alert">{state.message}</p><button className="button button-outline" onClick={() => window.location.reload()}>Try again</button></main>;
  return <main className="admin-orders-state"><p>Verifying administrator access…</p></main>;
}
