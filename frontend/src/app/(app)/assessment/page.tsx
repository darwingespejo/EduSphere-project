"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Gauge, RotateCcw, XCircle } from "lucide-react";
import Link from "@/router/link";
import { SphereLoader } from "@/components/Logo";
import { PageHeader, Ring, SkillBar, EmptyState } from "@/components/ui";
import { BadgeModal, type EarnedBadge } from "@/components/BadgeModal";
import { toast } from "@/components/Toasts";
import { useApi } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";

type Question = { id: string; type: "mcq" | "short"; prompt: string; options: string[] | null; points: number; skill: string | null };
type Placement = { assessment: { id: string; title: string } | null; questions: Question[]; bestScore: number | null };
type SubmitResult = {
  scorePct: number; earned: number; possible: number;
  perQuestion: { questionId: string; prompt: string; response: string; correct: boolean; expected: string; skill: string | null }[];
  skillGaps: { skill: string; score: number }[];
  badges: (EarnedBadge | null)[];
};

export default function AssessmentPage() {
  const { setUser } = useAuth();
  const placement = useApi<Placement>("/api/v1/assessments/placement");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [badgeQueue, setBadgeQueue] = useState<EarnedBadge[]>([]);

  const questions = useMemo(() => placement.data?.questions ?? [], [placement.data?.questions]);
  const answered = useMemo(() => questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length, [answers, questions]);
  const allAnswered = questions.length > 0 && answered === questions.length;

  if (placement.loading) return <SphereLoader label="Loading placement" />;
  if (!placement.data?.assessment) {
    return <EmptyState icon={<Gauge size={20} />} title="No placement configured" body="An instructor needs to seed assessment questions before this page can run." />;
  }

  const submit = async () => {
    setBusy(true);
    const res = await api.post<SubmitResult>("/api/v1/assessments/placement/submit", {
      answers: questions.map((q) => ({ questionId: q.id, response: answers[q.id] ?? "" })),
    });
    setBusy(false);
    if (!res.success) { toast.err(res.message); return; }
    setResult(res.data);
    const badges = (res.data.badges ?? []).filter(Boolean) as EarnedBadge[];
    if (badges.length) setBadgeQueue(badges);
    const me = await api.get<{ user: Parameters<typeof setUser>[0] }>("/api/v1/auth/me");
    if (me.success) setUser(me.data.user);
    toast.ok(res.message);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => { setResult(null); setAnswers({}); };

  if (result) return <ResultView result={result} onRetake={reset} badgeQueue={badgeQueue} setBadgeQueue={setBadgeQueue} bestScore={placement.data?.bestScore ?? null} />;

  return (
    <div>
      <PageHeader
        title="Placement assessment"
        sub="10 questions, about 5 minutes. Answer honestly rather than well â€” the learning path is built from your gaps, so sandbagging only cheats the sequencer."
        actions={<span className="tag">{answered}/{questions.length} answered</span>}
      />
      {placement.data.bestScore !== null && (
        <p className="text-sm text-muted -mt-4 mb-6">Your best score so far: <span className="font-mono text-text">{placement.data.bestScore}%</span>. Retaking regenerates your path around the new gaps.</p>
      )}
      <div className="space-y-4 max-w-3xl">
        {questions.map((q, i) => (
          <motion.div key={q.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[11px] text-muted">Q{i + 1} Â· {q.points} pts{q.skill ? ` Â· ${q.skill}` : ""}</p>
              {(answers[q.id] ?? "").trim() && <CheckCircle2 size={15} className="text-mint" />}
            </div>
            <p className="mt-2 font-medium leading-relaxed">{q.prompt}</p>
            {q.type === "mcq" ? (
              <div className="mt-4 grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label={`Question ${i + 1} options`}>
                {(q.options ?? []).map((opt) => {
                  const active = answers[q.id] === opt;
                  return (
                    <button key={opt} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${active ? "border-primary bg-primary/10 text-text" : "border-line bg-raised/40 text-muted hover:border-primary/50 hover:text-text"}`}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input className="input mt-4 font-mono" placeholder="Type your answerâ€¦" value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
            )}
          </motion.div>
        ))}
      </div>
      <div className="sticky bottom-5 mt-8 max-w-3xl">
        <div className="card p-4 flex items-center justify-between gap-4 shadow-2xl">
          <p className="text-sm text-muted">{allAnswered ? "All answered â€” ready to grade." : `${questions.length - answered} left unanswered will count as misses.`}</p>
          <button className="btn btn-primary" onClick={submit} disabled={busy || answered === 0}>
            {busy ? "Gradingâ€¦" : "Submit for grading"} <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultView({ result, onRetake, badgeQueue, setBadgeQueue, bestScore }: {
  result: SubmitResult; onRetake: () => void;
  badgeQueue: EarnedBadge[]; setBadgeQueue: (b: EarnedBadge[]) => void;
  bestScore: number | null;
}) {
  return (
    <div>
      {badgeQueue.length > 0 && <BadgeModal badges={badgeQueue} onClose={() => setBadgeQueue(badgeQueue.slice(1))} />}
      <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
        <div className="card p-7 text-center lg:sticky lg:top-24">
          <p className="eyebrow">Placement score</p>
          <div className="mt-4 flex justify-center">
            <Ring value={result.scorePct} size={150} stroke={11}
              color={result.scorePct >= 70 ? "var(--mint)" : result.scorePct >= 40 ? "var(--amber)" : "var(--coral)"}
              label={<div><p className="display text-4xl font-extrabold">{result.scorePct}%</p><p className="font-mono text-[10px] text-muted">{result.earned}/{result.possible} pts</p></div>} />
          </div>
          {bestScore !== null && (
            <p className="text-muted text-xs mt-4 font-mono">previous best {bestScore}%</p>
          )}
          <p className="text-sm text-muted mt-4 leading-relaxed">Your learning path was re-sequenced around the gaps below.</p>
          <div className="flex gap-2 mt-5">
            <Link href="/path" className="btn btn-primary flex-1 text-[13px]">Open my path</Link>
            <button onClick={onRetake} className="btn btn-ghost !px-3" aria-label="Retake"><RotateCcw size={15} /></button>
          </div>
        </div>
        <div className="space-y-5">
          <div className="card p-6">
            <h3 className="display font-bold text-lg mb-4">Skill gap report</h3>
            <div className="space-y-4">
              {result.skillGaps.map((g) => (
                <SkillBar key={g.skill} name={g.skill} value={g.score}
                  color={g.score < 40 ? "var(--coral)" : g.score < 70 ? "var(--amber)" : "var(--primary)"} />
              ))}
            </div>
          </div>
          <div className="card p-6">
            <h3 className="display font-bold text-lg mb-4">Question by question</h3>
            <div className="space-y-3">
              {result.perQuestion.map((p, i) => (
                <motion.div key={p.questionId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={`flex gap-3 p-3.5 rounded-xl border ${p.correct ? "border-mint/25 bg-mint/5" : "border-coral/25 bg-coral/5"}`}>
                  {p.correct ? <CheckCircle2 size={16} className="text-mint shrink-0 mt-0.5" /> : <XCircle size={16} className="text-coral shrink-0 mt-0.5" />}
                  <div className="text-sm min-w-0">
                    <p className="font-medium">{p.prompt}</p>
                    <p className="text-muted mt-1">Your answer: <span className="font-mono text-[12.5px]">{p.response || "(blank)"}</span></p>
                    {!p.correct && <p className="text-muted mt-0.5">Expected: <span className="font-mono text-[12.5px] text-mint">{p.expected}</span></p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
