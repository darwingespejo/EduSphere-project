"use client";
import { useEffect, useState } from "react";
import Link from "@/router/link";
import { useRouter } from "@/router/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Logo, SphereLoader } from "@/components/Logo";
import { toast, ToastHost } from "@/components/Toasts";
import GoogleAuth, { type GoogleSession } from "@/components/GoogleAuth";
import { getPostAuthPath, hydrateAuth, useAuth } from "@/lib/store";
import { api } from "@/lib/api";

type LoginData = { user: never; access: string; refresh: string };

export default function LoginPage() {
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  useEffect(() => { hydrateAuth(); }, []);
  useEffect(() => {
    if (hydrated && user) router.replace(user.role === "admin" ? "/admin" : user.role === "instructor" ? "/instructor" : "/dashboard");
  }, [hydrated, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErr({});
    setBusy(true);
    const res = await api.post<LoginData>("/api/v1/auth/login", { email, password });
    setBusy(false);
    if (!res.success) {
      if (res.errors) setFieldErr(res.errors);
      toast.err(res.message);
      return;
    }
    useAuth.getState().setAuth(res.data.user, res.data.access, res.data.refresh);
    toast.ok(`Signed in as ${(res.data.user as { name: string }).name.split(" ")[0]}.`);
    const nextPath = getPostAuthPath(res.data.user);
    router.replace(nextPath);
  };

  const handleGoogleSuccess = (session: GoogleSession) => {
    useAuth.getState().setAuth(session.user, session.access, session.refresh);
    toast.ok("Signed in with Google.");
    router.replace(getPostAuthPath(session.user, { isNew: session.isNew }));
  };

  if (!hydrated) return <div className="min-h-screen grid place-items-center"><SphereLoader /></div>;

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-10 border-r border-line relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/6958509/pexels-photo-6958509.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1600"
          alt="Student studying at home with laptop, books, and headphones"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/85 via-bg/60 to-bg/90" />
        <Link href="/" className="relative"><Logo /></Link>
        <div className="relative">
          <h2 className="display text-3xl font-extrabold tracking-tight leading-tight">Your path kept its place.</h2>
          <p className="text-muted mt-3 max-w-sm text-[15px] leading-relaxed">
            The placement report, unlocked items, streak, and review queue are exactly where you left them. Sign back in and the next node starts pulsing again.
          </p>
        </div>
        <p className="text-muted font-mono text-[11px] relative">Demo accounts: aria@edusphere.dev · instructor@edusphere.dev · admin@edusphere.dev</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[380px]">
          <Link href="/" className="md:hidden inline-block mb-8"><Logo /></Link>
          <h1 className="display text-[26px] font-bold tracking-tight">Sign in</h1>
          <p className="text-muted text-sm mt-1.5">Demo password for every seeded account is <span className="font-mono text-mint">password123</span>.</p>
          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="text-sm font-medium block mb-1.5">Email</label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aria@edusphere.dev" autoComplete="email" />
              {fieldErr.email && <p className="text-coral text-xs mt-1.5">{fieldErr.email}</p>}
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium block mb-1.5">Password</label>
              <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password123" autoComplete="current-password" />
              {fieldErr.password && <p className="text-coral text-xs mt-1.5">{fieldErr.password}</p>}
            </div>
            <button className="btn btn-primary w-full !py-3" disabled={busy}>
              {busy ? "Checking…" : "Sign in"} <ArrowRight size={15} />
            </button>
          </form>
          <div className="flex items-center gap-3 text-xs text-muted my-5">
            <span className="h-px flex-1 bg-line" />
            or continue with
            <span className="h-px flex-1 bg-line" />
          </div>
          <GoogleAuth mode="login" onSuccess={handleGoogleSuccess} />
          <p className="text-sm text-muted mt-6 text-center">No account yet? <Link href="/register" className="link">Create one</Link></p>
        </motion.div>
      </div>
      <ToastHost />
    </div>
  );
}
