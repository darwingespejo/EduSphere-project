"use client";

import { useState } from "react";
import Link from "@/router/link";
import { useRouter } from "@/router/navigation";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { toast, ToastHost } from "@/components/Toasts";
import { api } from "@/lib/api";
import { getPostAuthPath, useAuth, type User } from "@/lib/store";

type Session = { user: User; access: string; refresh: string };

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const res = await api.post<Session>("/api/v1/auth/verify-email", { email, code });
    setBusy(false);
    if (!res.success) {
      toast.err(res.message);
      return;
    }
    useAuth.getState().setAuth(res.data.user, res.data.access, res.data.refresh);
    toast.ok("Email verified. Your account is ready.");
    router.replace(getPostAuthPath(res.data.user, { isNew: true }));
  };

  const resend = async () => {
    setResending(true);
    const res = await api.post<null>("/api/v1/auth/resend-verification", { email });
    setResending(false);
    if (res.success) toast.ok(res.message);
    else toast.err(res.message);
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 relative overflow-hidden">
      <div className="glow-blob w-[420px] h-[420px] -top-32 -right-32" style={{ background: "var(--glow-mint)" }} />
      <div className="w-full max-w-[400px] relative">
        <Link href="/"><Logo /></Link>
        <h1 className="display text-[26px] font-bold tracking-tight mt-8">Verify your email</h1>
        <p className="text-muted text-sm mt-2">Enter the email address you registered with and the 8-digit code we sent to its inbox.</p>
        <form onSubmit={verify} className="mt-7 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium block mb-1.5">Email address</label>
            <input id="email" type="email" required className="input" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </div>
          <div>
            <label htmlFor="code" className="text-sm font-medium block mb-1.5">Verification code</label>
            <input id="code" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required className="input font-mono tracking-[0.3em]" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} autoComplete="one-time-code" />
          </div>
          <button className="btn btn-primary w-full !py-3" disabled={busy}>
            {busy ? "Verifying…" : "Verify email"} <ArrowRight size={15} />
          </button>
        </form>
        <button type="button" onClick={resend} disabled={resending || !email} className="btn btn-ghost w-full mt-3">
          {resending ? "Sending…" : "Send a new code"}
        </button>
        <p className="text-sm text-muted mt-6 text-center">Already verified? <Link href="/login" className="link">Sign in</Link></p>
      </div>
      <ToastHost />
    </div>
  );
}
