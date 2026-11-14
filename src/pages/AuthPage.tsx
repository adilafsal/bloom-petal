import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthView } from "@neondatabase/auth/react";
import { useAuthSession } from "../lib/auth-client";
import "../auth.css";

export default function AuthPage() {
  const { path = "sign-in" } = useParams();
  const navigate = useNavigate();
  const { data, isPending } = useAuthSession();

  useEffect(() => {
    if (path === "sign-in" && !isPending && data?.user) {
      navigate("/admin/orders", { replace: true });
    }
  }, [path, isPending, data, navigate]);

  return <main className="auth-page"><div className="auth-layout"><section className="auth-visual"><img src="https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=85" alt="Seasonal flowers gathered at the Bloom & Petal flower shop"/><div><span className="eyebrow">BLOOM & PETAL · DUBAI</span><p>For life's little moments,<br/><em>made beautiful.</em></p></div></section><section className="auth-panel"><Link to="/" className="auth-wordmark">Bloom <i>&</i> Petal</Link><p className="auth-intro">A quiet little sign-in for the flower shop team.</p><section className="auth-card"><AuthView path={path} redirectTo="/admin/orders"/></section><Link to="/" className="auth-back">Back to the flower shop</Link></section></div></main>;
}
