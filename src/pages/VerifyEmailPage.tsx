import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, MailCheck } from "lucide-react";
import AuthShell from "../components/AuthShell";
import { authClient } from "../lib/auth-client";
import { safeAuthRedirect } from "../lib/auth-redirect";

const CODE_LENGTH = 6;
const RESEND_DELAY = 60;

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = (params.get("email") ?? "").trim().toLowerCase();
  const redirectTo = safeAuthRedirect(params.get("redirectTo"));
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [mode, setMode] = useState<"idle" | "code" | "link">("idle");
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const sending = useRef(false);
  const verifying = useRef(false);
  const code = digits.join("");

  const sendCode = useCallback(async (isResend: boolean) => {
    if (sending.current || secondsLeft > 0) return;
    if (!email) { setMode("link"); setError("The email address is missing. Sign in again and return to verification."); return; }
    sending.current = true;
    if (isResend) setResending(true); else setBusy(true);
    setError(""); setMessage("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      if (result.error) throw new Error(result.error.message || "The verification code could not be sent.");
      setMode("code"); setDigits(Array(CODE_LENGTH).fill("")); setSecondsLeft(RESEND_DELAY);
      setMessage(`We've sent a 6-digit verification code to ${email}.`);
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : "";
      if (import.meta.env.DEV) console.error("[Neon Auth] verification-code send failed:", detail || "Unknown error");
      if (/not found|not enabled|unknown|404|email-otp/i.test(detail)) {
        setMode("link");
        try {
          const fallback = await authClient.sendVerificationEmail({ email });
          if (fallback.error) throw new Error(fallback.error.message || "Verification email could not be sent.");
          setMessage("This Neon Auth project is using verification links. Open the link in your email to verify your account.");
          setSecondsLeft(RESEND_DELAY);
          setError("");
        } catch (linkFailure) {
          setError(linkFailure instanceof Error ? linkFailure.message : "Verification email could not be sent.");
        }
      } else {
        setError(detail || "The verification code could not be sent. Please try again.");
      }
    } finally { sending.current = false; setBusy(false); setResending(false); }
  }, [email, secondsLeft]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (verifying.current) return;
    if (code.length !== CODE_LENGTH || !/^\d{6}$/.test(code)) { setError("Enter all 6 digits from the email."); return; }
    verifying.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp: code });
      if (result.error) throw new Error(result.error.message || "That code is invalid or expired. Request a new code and try again.");
      const latest = await authClient.getSession({ query: { disableCookieCache: true } });
      if (!latest.data?.user?.emailVerified) throw new Error("Neon Auth did not confirm this email as verified. Try the code again or request a new one.");
      setMessage("Email verified successfully. Checking administrator access…");
      navigate(redirectTo, { replace: true });
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : "That code is invalid or expired. Request a new code and try again.";
      if (import.meta.env.DEV) console.error("[Neon Auth] email verification failed:", detail);
      setError(/expired|invalid|otp|code/i.test(detail) ? "That code is invalid or expired. Request a new code and try again." : detail);
    } finally { verifying.current = false; setBusy(false); }
  }

  function setDigit(index: number, value: string) {
    const numeric = value.replace(/\D/g, "");
    if (numeric.length > 1) {
      const pasted = numeric.slice(0, CODE_LENGTH).split("");
      setDigits(Array.from({ length: CODE_LENGTH }, (_, position) => pasted[position] || ""));
      inputs.current[Math.min(pasted.length, CODE_LENGTH) - 1]?.focus();
      return;
    }
    const next = [...digits]; next[index] = numeric; setDigits(next);
    if (numeric && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  function pasteCode(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array.from({ length: CODE_LENGTH }, (_, index) => pasted[index] || ""));
    inputs.current[Math.min(pasted.length, CODE_LENGTH) - 1]?.focus();
  }

  return <AuthShell><section className="auth-panel"><Link to="/" className="auth-wordmark">Bloom <i>&</i> Petal</Link><p className="auth-intro">One small step before your account is ready.</p><div className="auth-card"><MailCheck size={24} color="var(--forest)"/><h1>{mode === "link" ? <>Check your <em>inbox.</em></> : <>Verify your <em>email.</em></>}</h1>{mode === "idle"&&<><p className="auth-verification-address">Send one verification code to <strong>{email || "your account email"}</strong>. No code is sent until you request it.</p>{error&&<p className="auth-form-error" role="alert">{error}</p>}<button className="auth-send-code" type="button" disabled={busy||!email} onClick={()=>void sendCode(false)}>{busy?"Sending code…":"Send verification code"}</button></>}{mode === "code"&&<><p className="auth-verification-address">We've sent a 6-digit verification code to <strong>{email}</strong>.</p><form onSubmit={verify}><label>6-digit verification code</label><div className="auth-otp-inputs" onPaste={pasteCode}>{digits.map((digit,index)=><input key={index} ref={element=>{inputs.current[index]=element;}} aria-label={`Verification code digit ${index+1}`} autoComplete={index===0?"one-time-code":"off"} inputMode="numeric" pattern="[0-9]*" maxLength={6} value={digit} onChange={event=>setDigit(index,event.target.value)} onKeyDown={event=>handleKeyDown(index,event)} disabled={busy}/>)}</div>{error&&<p className="auth-form-error" role="alert">{error}</p>}{message&&<p className="auth-form-success" role="status">{message}</p>}<button type="submit" disabled={busy||code.length!==CODE_LENGTH}>{busy?"Verifying…":"Verify email"} {!busy&&<ArrowRight size={15}/>}</button></form><button className="auth-resend" type="button" disabled={resending||secondsLeft>0||busy} onClick={()=>void sendCode(true)}>{resending?"Sending code…":secondsLeft>0?`Resend code in ${secondsLeft}s`:"Resend code"}</button><small className="auth-code-note">Codes expire after 15 minutes. If this project uses link verification, open the link in your email.</small></>}{mode === "link"&&<><p className="auth-verification-address">{message||"Your Neon Auth project is configured to verify email by link."}</p>{error&&<p className="auth-form-error" role="alert">{error}</p>}<button className="auth-resend" type="button" disabled={resending} onClick={()=>void sendCode(true)}>{resending?"Sending…":"Resend verification email"}</button></>}</div><Link to="/auth/sign-in" className="auth-back">Back to sign in</Link></section></AuthShell>;
}
