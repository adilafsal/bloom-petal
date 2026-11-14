import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, MailCheck } from "lucide-react";
import AuthShell from "../components/AuthShell";
import { authClient } from "../lib/auth-client";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const email = params.get("email") ?? "";
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp: otp.trim() });
      if (result.error) throw new Error(result.error.message || "Verification failed.");
      if (result.data?.session) navigate("/admin/orders", { replace: true });
      else {
        setMessage("Email verified. You can now sign in.");
        navigate("/auth/sign-in", { replace: true, state: { verified: true } });
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That verification code is invalid or expired.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    setError("");
    setMessage("");
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: `${location.pathname}?email=${encodeURIComponent(email)}` });
      if (result.error) throw new Error(result.error.message || "Could not resend the verification email.");
      setMessage("Verification email resent. Please check your inbox and spam folder.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not resend the verification email.");
    } finally {
      setResending(false);
    }
  }

  return <AuthShell><section className="auth-panel"><Link to="/" className="auth-wordmark">Bloom <i>&</i> Petal</Link><p className="auth-intro">One small step before your account is ready.</p><div className="auth-card"><MailCheck size={24} color="var(--forest)"/><h1>Check your <em>inbox.</em></h1><p className="auth-verification-address">Verification code sent to <strong>{email || "your email address"}</strong></p><form onSubmit={verify}><label>Verification code<input inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={event => setOtp(event.target.value)}/></label>{error&&<p className="auth-form-error" role="alert">{error}</p>}{message&&<p className="auth-form-success" role="status">{message}</p>}<button type="submit" disabled={busy||!email}>{busy?"Verifying…":"Verify email"} {!busy&&<ArrowRight size={15}/>}</button></form><button className="auth-resend" type="button" disabled={resending||!email} onClick={() => void resend()}>{resending?"Sending…":"Resend verification email"}</button><small className="auth-code-note">Verification codes expire after 15 minutes.</small></div><Link to="/auth/sign-in" className="auth-back">Back to sign in</Link></section></AuthShell>;
}
