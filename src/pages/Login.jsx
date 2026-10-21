import { useState } from "react";
import { Loader2 } from "lucide-react";
import { signIn } from "../lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <main className="min-h-[100dvh] grid place-items-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <form
        className="w-full max-w-sm rise"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await signIn(email.trim(), password);
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <img src="/icon.svg" alt="" className="w-16 h-16 rounded-[18px] mb-6" />
        <h1 className="text-[34px] font-bold tracking-tight leading-tight">הבית</h1>
        <p className="text-muted mt-1 mb-8">קניות, מטלות, שוברים וכסף - במקום אחד.</p>
        <div className="space-y-3">
          <input className="field bg-card" type="email" autoComplete="email" inputMode="email" placeholder="אימייל" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="field bg-card" type="password" autoComplete="current-password" placeholder="סיסמה" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-crit text-[14px] mt-3 px-1">{error}</p>}
        <button type="submit" className="btn btn-primary w-full mt-5" disabled={busy}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : "כניסה"}
        </button>
      </form>
    </main>
  );
}
