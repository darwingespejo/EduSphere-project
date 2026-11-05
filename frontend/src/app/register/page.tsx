"use client";
import { useState } from "react";
import Link from "@/router/link";
import { useRouter } from "@/router/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { toast, ToastHost } from "@/components/Toasts";
import GoogleAuth, { type GoogleSession } from "@/components/GoogleAuth";
import { api } from "@/lib/api";
import { getPostAuthPath, useAuth } from "@/lib/store";

type RegisterData = { email: string };

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErr({});
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFieldErr({ email: "Enter a valid email address." });
      toast.err("Enter a valid email address to continue.");
      return;
    }
    setBusy(true);
    const res = await api.post<RegisterData>("/api/v1/auth/register", { name, email: trimmedEmail, password });
    setBusy(false);
    if (!res.success) {
      if (res.errors) setFieldErr(res.errors);
      toast.err(res.message);
      return;
    }
    toast.ok("Check your inbox for the verification code.");
    router.replace("/verify-email");
  };

  const handleGoogleSuccess = (session: GoogleSession) => {
    useAuth.getState().setAuth(session.user, session.access, session.refresh);
    toast.ok("Your account is ready.");
    router.replace(getPostAuthPath(session.user, { isNew: session.isNew }));
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 relative overflow-hidden">
      <div className="glow-blob w-[420px] h-[420px] -top-32 -right-32" style={{ background: "var(--glow-mint)" }} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[400px] relative">
        <Link href="/"><Logo /></Link>
        <h1 className="display text-[26px] font-bold tracking-tight mt-8">Create your account</h1>
        <p className="text-muted text-sm mt-1.5">Registration puts you on the free plan. Card not required — this demo can&apos;t charge one anyway.</p>
        <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="text-sm font-medium block mb-1.5">Name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
            {fieldErr.name && <p className="text-coral text-xs mt-1.5">{fieldErr.name}</p>}
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium block mb-1.5">Email address</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            {fieldErr.email && <p className="text-coral text-xs mt-1.5">{fieldErr.email}</p>}
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium block mb-1.5">Password <span className="text-muted font-normal">(8+ characters)</span></label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            {fieldErr.password && <p className="text-coral text-xs mt-1.5">{fieldErr.password}</p>}
          </div>
          <button className="btn btn-primary w-full !py-3" disabled={busy}>
            {busy ? "Creating…" : "Create account"} <ArrowRight size={15} />
          </button>
        </form>
        <div className="flex items-center gap-3 text-xs text-muted my-5">
          <span className="h-px flex-1 bg-line" />
          or continue with
          <span className="h-px flex-1 bg-line" />
        </div>
        <GoogleAuth mode="register" onSuccess={handleGoogleSuccess} />
        <p className="text-sm text-muted mt-6 text-center">Already registered? <Link href="/login" className="link">Sign in</Link></p>
      </motion.div>
      <ToastHost />
    </div>
  );
}
