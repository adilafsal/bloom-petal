import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AuthShell from "../components/AuthShell";
import { authClient } from "../lib/auth-client";
import { emailVerificationCallback } from "../lib/auth-redirect";

export default function SignUpPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const normalizedEmail = email.trim();
      const callbackURL = emailVerificationCallback(normalizedEmail);
      const result = await authClient.signUp.email({ name: name.trim(), email: normalizedEmail, password, callbackURL });
      if (result.error) throw new Error(result.error.message || "Sign-up failed.");
      if (result.data?.user) {
        if (result.data.user.emailVerified) navigate("/auth/sign-in", { replace: true });
        else { const verifyURL = new URL(callbackURL); navigate(`${verifyURL.pathname}${verifyURL.search}`, { replace: true }); }
      } else {
        setError("Neon Auth did not confirm the account. Please try again.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We couldn't create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell><section className="auth-panel"><Link to="/" className="auth-wordmark">Bloom <i>&</i> Petal</Link><p className="auth-intro">Join the Bloom & Petal flower shop team.</p><div className="auth-card"><h1>Create your <em>account.</em></h1><form onSubmit={submit}><label>Full name<input autoComplete="name" required value={name} onChange={event => setName(event.target.value)}/></label><label>Email address<input autoComplete="email" type="email" required value={email} onChange={event => setEmail(event.target.value)}/></label><label>Password<input autoComplete="new-password" type="password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)}/><small>Use at least 8 characters.</small></label>{error&&<p className="auth-form-error" role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy?"Creating account…":"Create account"} {!busy&&<ArrowRight size={15}/>}</button></form><p className="auth-switch">Already have an account? <Link to="/auth/sign-in">Sign in</Link></p></div><Link to="/" className="auth-back">Back to the flower shop</Link></section></AuthShell>;
}
