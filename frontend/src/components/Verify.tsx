"use client";
import { useEffect, useRef, useState } from "react";
import Link from "@/router/link";
import { useRouter } from "@/router/navigation";
import { motion } from "framer-motion";
import { Mail, Search, ShieldCheck, ShieldX } from "lucide-react";
import { Logo, SphereLoader } from "./Logo";

type VerifyData = { valid: true; code: string; holder: string; course: string; level: string; issuedAt: string };
type VerifyResponse = VerifyData & { issued_at?: string };

export default function VerifyClient({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [input, setInput] = useState(initialCode);
  const [data, setData] = useState<VerifyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!initialCode);

  useEffect(() => {
    if (!initialCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/verify/${encodeURIComponent(initialCode.trim())}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          const credential = json.data as VerifyResponse;
          setData({ ...credential, issuedAt: credential.issuedAt ?? credential.issued_at ?? "" });
        }
        else { setData(null); setError(json.message); }
      } catch {
        if (!cancelled) setError("The verification service didn't answer. Try again in a moment.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [initialCode]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-[1160px] w-full mx-auto px-5 md:px-8 h-[76px] flex items-center justify-between print:hidden">
        <Link href="/"><Logo /></Link>
        <Link href="/login" className="btn btn-ghost !py-2">Sign in</Link>
      </header>

      <main className="flex-1 max-w-[1080px] w-full mx-auto px-5 py-12">
        <div className="print:hidden max-w-3xl">
          <p className="eyebrow flex items-center gap-2"><ShieldCheck size={14} /> Credential verification</p>
          <h1 className="display text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight mt-3">Check a certificate before you trust it</h1>
          <p className="text-muted mt-3 max-w-xl">Paste the code printed on an EduSphere certificate — format <span className="font-mono">EDU-XXXX-XXXX</span>. This page reads the public endpoint <span className="font-mono text-xs">GET /api/v1/verify/:code</span>; no login needed.</p>
          <form
            className="flex gap-2 mt-7"
            onSubmit={(e) => { e.preventDefault(); if (input.trim()) router.push(`/verify/${input.trim().toUpperCase()}`); }}
          >
            <input className="input font-mono uppercase" value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="EDU-7Q4M-92XT" aria-label="Credential code" />
            <button className="btn btn-primary shrink-0"><Search size={15} /> Verify</button>
          </form>
        </div>

        <div className="mt-8">
          {loading && <SphereLoader label="Looking up the registry" />}
          {!loading && error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 flex items-start gap-4 border-coral/40">
              <ShieldX size={22} className="text-coral shrink-0 mt-0.5" />
              <div>
                <h2 className="display font-bold text-lg">Not a valid credential</h2>
                <p className="text-muted text-sm mt-1">{error}</p>
              </div>
            </motion.div>
          )}
          {!loading && data && <Certificate data={data} />}
        </div>
      </main>

      <footer className="border-t border-line py-6 print:hidden">
        <p className="max-w-[1160px] mx-auto px-5 md:px-8 text-muted text-xs font-mono">Verification is public by design — the code authorizes the lookup.</p>
      </footer>
    </div>
  );
}

function Certificate({ data }: { data: VerifyData }) {
  const [recipient, setRecipient] = useState("");
  const recipientInput = useRef<HTMLInputElement>(null);
  const parsedDate = data.issuedAt ? new Date(data.issuedAt) : null;
  const issuedDate = parsedDate && Number.isFinite(parsedDate.getTime())
    ? parsedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Date unavailable";
  const gmailUrl = new URL("https://mail.google.com/mail/");
  gmailUrl.searchParams.set("view", "cm");
  gmailUrl.searchParams.set("fs", "1");
  gmailUrl.searchParams.set("to", recipient.trim());
  gmailUrl.searchParams.set("su", `Certificate of completion - ${data.course}`);
  gmailUrl.searchParams.set(
    "body",
    `Hello,\n\nI'm sharing my EduSphere certificate of completion.\n\nRecipient: ${data.holder}\nCourse: ${data.course}\nLevel: ${data.level}\nIssued: ${issuedDate}\nCertificate ID: ${data.code}\n\nVerify this certificate: ${window.location.origin}/verify/${encodeURIComponent(data.code)}\n\nRegards,\n${data.holder}`,
  );

  return (
    <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }} className="certificate-print-root">
      <div className="certificate-sheet">
        <div className="certificate-watermark" aria-hidden="true" />
        <div className="certificate-inner">
          <div className="flex items-center justify-between gap-4 border-b border-line/70 pb-5">
            <Logo size={30} />
            <div className="flex items-center gap-2 rounded-full border border-mint/30 bg-mint/5 px-3 py-1.5 text-mint">
              <ShieldCheck size={15} />
              <span className="font-mono text-[10px] tracking-[0.16em] uppercase">Verified credential</span>
            </div>
          </div>

          <div className="flex flex-col items-center text-center py-9 md:py-11">
            <p className="eyebrow text-mint">Certificate of completion</p>
            <p className="mt-5 text-sm text-muted">This certificate is proudly presented to</p>
            <h2 className="display mt-2 text-[clamp(34px,6vw,58px)] font-extrabold tracking-tight leading-tight">{data.holder}</h2>
            <div className="mt-5 h-px w-24 bg-gradient-to-r from-transparent via-primary to-transparent" />
            <p className="mt-5 text-sm text-muted">for successfully completing</p>
            <p className="font-accent mt-1 text-[clamp(24px,4vw,36px)] italic text-text">{data.course}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="capitalize">{data.level} level</span>
              <span aria-hidden>·</span>
              <span>Issued {issuedDate}</span>
            </div>
          </div>

          <div className="flex flex-col gap-5 border-t border-line/70 pt-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Certificate ID</p>
              <p className="mt-1 font-mono text-sm tracking-[0.16em]">{data.code}</p>
              <p className="mt-1 text-xs text-muted">Verify at edusphere.dev/verify</p>
            </div>
            <div className="flex items-center gap-3 sm:text-right">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-mint/30 bg-mint/5 text-mint">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="font-accent text-lg italic">EduSphere</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Academic Registry</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 print:hidden">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="certificate-recipient-email">Recipient email address</label>
          <input
            id="certificate-recipient-email"
            ref={recipientInput}
            className="input sm:max-w-sm"
            type="email"
            autoComplete="email"
            required
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="Recipient email address"
          />
          <a
            href={gmailUrl.toString()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary shrink-0"
            onClick={(event) => {
              if (!recipientInput.current?.reportValidity()) event.preventDefault();
            }}
          >
            <Mail size={15} /> Compose in Gmail
          </a>
        </div>
        <p className="mt-2 text-xs text-muted">Opens a pre-filled Gmail draft with the certificate verification link. Review and send it in Gmail.</p>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="flex items-center gap-2 text-xs text-mint"><ShieldCheck size={14} /> Valid · registry lookup positive</p>
        <button className="btn btn-ghost !py-2" onClick={() => window.print()}>Print / save as PDF</button>
      </div>
    </motion.div>
  );
}
