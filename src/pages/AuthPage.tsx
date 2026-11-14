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

  return <main className="auth-page"><Link to="/" className="auth-wordmark">Bloom <i>&</i> Petal</Link><p className="auth-intro">A quiet little sign-in for the flower shop team.</p><section className="auth-card"><AuthView path={path} redirectTo="/admin/orders"/></section><Link to="/" className="auth-back">Back to the flower shop</Link></main>;
}
