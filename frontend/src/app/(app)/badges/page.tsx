"use client";
import Link from "@/router/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, ExternalLink, Mail } from "lucide-react";
import { SphereLoader } from "@/components/Logo";
import { BadgeIcon } from "@/components/BadgeModal";
import { PageHeader, SectionTitle, EmptyState } from "@/components/ui";
import { toast } from "@/components/Toasts";
import { api } from "@/lib/api";
import { fmtDate, useApi } from "@/lib/hooks";

type Badges = {
  earned: { id: string; code: string; name: string; description: string; icon: string; accent: string; xpReward: number; awardedAt: string }[];
  upcoming: { code: string; name: string; description: string; icon: string; accent: string }[];
};
type Cert = { code: string; issuedAt: string; course: string };

export default function BadgesPage() {
  const badges = useApi<Badges>("/api/v1/badges");
  const certs = useApi<Cert[]>("/api/v1/certificates");
  const [sendingCode, setSendingCode] = useState<string | null>(null);

  const emailCertificate = async (code: string) => {
    if (sendingCode) return;
    setSendingCode(code);
    const result = await api.post<{ sent: boolean }>(`/api/v1/certificates/${encodeURIComponent(code)}/email`);
    setSendingCode(null);
    if (result.success) toast.ok("Certificate sent to your registered email address.");
    else toast.err(result.message);
  };

  if (badges.loading || certs.loading) return <SphereLoader label="Loading credentials" />;
  const b = badges.data;
  if (!b) return <p className="text-muted">Could not load badges.</p>;

  return (
    <div className="space-y-10">
      <PageHeader title="Badges & certificates" sub="Badges pay one-time XP bonuses. Certificates are issued when you finish an entire path, and each gets a public verification code." />

      <div>
        <SectionTitle title="Certificates" />
        {(certs.data ?? []).length === 0 ? (
          <EmptyState icon={<BadgeCheck size={20} />} title="No certificates yet"
            body="Finish every lesson on a learning path and one is issued automatically. A seeded example lives at /verify/EDU-7Q4M-92XT." />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {(certs.data ?? []).map((c, i) => (
              <motion.div key={c.code} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="card p-6 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(80% 60% at 100% 0%, var(--glow-primary), transparent)" }} />
                <p className="eyebrow">Certificate of completion</p>
                <h3 className="display font-bold text-xl mt-2 font-accent italic">{c.course}</h3>
                <p className="font-mono text-xs text-muted mt-2">issued {fmtDate(c.issuedAt)}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-5">
                  <span className="font-mono text-[13px] tracking-widest text-mint">{c.code}</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void emailCertificate(c.code)}
                      disabled={sendingCode !== null}
                      className="btn btn-ghost !py-1.5 !px-3 text-[13px]"
                    >
                      <Mail size={12} /> {sendingCode === c.code ? "Sending…" : "Email to me"}
                    </button>
                    <Link href={`/verify/${c.code}`} className="btn btn-ghost !py-1.5 !px-3 text-[13px]" target="_blank">
                      Verify link <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle title={`Badges earned â€” ${b.earned.length}/8`} />
        {b.earned.length === 0 ? (
          <p className="text-muted text-sm">Nothing earned yet. Complete a lesson, pass an exercise&apos;s hidden tests, or hold a streak to start.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {b.earned.map((bd, i) => (
              <motion.div key={bd.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="card p-5">
                <BadgeIcon badge={bd} size={44} />
                <h4 className="font-semibold text-sm mt-3">{bd.name}</h4>
                <p className="text-muted text-xs mt-1 leading-relaxed">{bd.description}</p>
                <p className="font-mono text-[10px] text-muted mt-3">{fmtDate(bd.awardedAt)}{bd.xpReward > 0 ? ` Â· +${bd.xpReward} XP` : ""}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {b.upcoming.length > 0 && (
        <div>
          <SectionTitle title="Still locked" sub="Every badge lists its unlock condition" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {b.upcoming.map((bd) => (
              <div key={bd.code} className="card p-5 opacity-55">
                <div className="grayscale"><BadgeIcon badge={bd} size={44} /></div>
                <h4 className="font-semibold text-sm mt-3">{bd.name}</h4>
                <p className="text-muted text-xs mt-1 leading-relaxed">{bd.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
