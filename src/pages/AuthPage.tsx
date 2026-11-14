import { Link, useParams } from "react-router-dom";
import { AuthView } from "@neondatabase/auth/react";
import "../auth.css";

export default function AuthPage() {
  const { path = "sign-in" } = useParams();
  return <main className="auth-page"><Link to="/" className="auth-wordmark">Bloom <i>&</i> Petal</Link><p className="auth-intro">A quiet little sign-in for the flower shop team.</p><section className="auth-card"><AuthView path={path} redirectTo="/admin"/></section><Link to="/" className="auth-back">Back to the flower shop</Link></main>;
}
