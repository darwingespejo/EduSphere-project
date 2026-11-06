"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/router/link";
import { motion } from "framer-motion";
import { Check, Gauge, Lock, Play, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "@/router/navigation";
import { SphereLoader } from "@/components/Logo";
import { Constellation, type PathNode } from "@/components/Constellation";
import { PageHeader, SectionTitle, EmptyState } from "@/components/ui";
import { BadgeModal, type EarnedBadge } from "@/components/BadgeModal";
import PicoWidget from "@/components/PicoWidget";
import { toast } from "@/components/Toasts";
import { useApi } from "@/lib/hooks";
import { api } from "@/lib/api";

type PathData = {
  path: { id: string; rationale: string; velocity: string; status: string } | null;
  items: PathNode[];
  course: { title: string; level: string } | null;
  questions?: PracticeQuestion[];
  hasPlacement?: boolean;
  badge?: EarnedBadge | null;
};

type PracticeQuestion = {
  module_title: string;
  quiz_title: string;
  question_id: string;
  type: "multiple_choice" | "identification";
  prompt: string;
  options: string[];
};

export default function PathPage() {
  const router = useRouter();
  const pathRes = useApi<PathData>("/api/v1/learning-path");
  const subscriptionRes = useApi<{ assistantAvailable: boolean }>("/api/v1/payments/subscription");
  const [regenerating, setRegenerating] = useState(false);
  const [badge, setBadge] = useState<EarnedBadge[]>([]);
  const [generating, setGenerating] = useState(false);
  const autoBuildStarted = useRef(false);

  const data = pathRes.data;
  const items = data?.items ?? [];
  const done = items.filter((i) => i.status === "done").length;

  const buildPath = useCallback(async () => {
    setGenerating(true);
    const r = await api.post<PathData>("/api/v1/learning-path/generate");
    setGenerating(false);
    if (r.success && r.data.path) {
      pathRes.setData(r.data);
      if (r.data.badge) setBadge([r.data.badge]);
      toast.ok(r.message);
    } else {
      toast.err(r.success ? "The learning path could not be created. Please try again." : r.message);
    }
  }, [pathRes.setData]);

  useEffect(() => {
    if (!data || data.path || !data.hasPlacement || autoBuildStarted.current) return;
    autoBuildStarted.current = true;
    void buildPath();
  }, [buildPath, data]);

  if (pathRes.loading) return <SphereLoader label="Charting your path" />;

  if (!data?.path) {
    return (
      <EmptyState
        icon={<Gauge size={20} />}
        title={pathRes.error ? "Could not load your path" : generating ? "Building your learning path" : "No path yet"}
        body={pathRes.error
          ? pathRes.error
          : generating
            ? "Your placement is complete. We’re using your results to prepare your lesson sequence."
            : "Take the placement so we can sequence lessons around your skill gaps."}
        action={
          <div className="flex gap-2 mt-2">
            {pathRes.error ? (
              <button className="btn btn-primary" onClick={() => void pathRes.refetch()}>Try again</button>
            ) : data?.hasPlacement ? (
              <button className="btn btn-primary" disabled={generating} onClick={() => void buildPath()}>
                {generating ? "Building…" : "Build my path"}
              </button>
            ) : (
              <Link href="/assessment" className="btn btn-primary">Take the placement</Link>
            )}
          </div>
        }
      />
    );
  }

  const regenerate = async () => {
    setRegenerating(true);
    const r = await api.post<PathData>("/api/v1/learning-path/generate");
    setRegenerating(false);
    if (r.success && r.data.path) { toast.ok("Path re-sequenced with your latest scores."); pathRes.setData(r.data); }
    else if (r.success) toast.err("The learning path could not be generated. Please try again.");
    else toast.err(r.message);
  };

  const progress = items.length ? Math.round((done / items.length) * 100) : 0;
  const practiceQuestions = data.questions ?? [];
  const assistantAvailable = subscriptionRes.data?.assistantAvailable === true;

  return (
    <div className="space-y-8">
      {badge.length > 0 && <BadgeModal badges={badge} onClose={() => setBadge([])} />}
      <PageHeader
        title={data.course ? `${data.course.title} — your orbit` : "My learning path"}
        sub={data.path.rationale}
        actions={
          <button className="btn btn-ghost" onClick={regenerate} disabled={regenerating}>
            <RefreshCw size={15} className={regenerating ? "animate-spin" : ""} /> {regenerating ? "Re-sequencing…" : "Regenerate"}
          </button>
        }
      />

      <section className="card p-5 md:p-6" aria-label="Pico AI study assistant">
        <div className="flex items-center gap-2">
          <Sparkles size={17} className="text-primary" />
          <h2 className="display font-bold">Pico AI study assistant</h2>
        </div>
        {subscriptionRes.error ? (
          <div className="mt-3" role="alert">
            <p className="text-sm text-coral">{subscriptionRes.error}</p>
            <button type="button" className="btn btn-ghost mt-2" onClick={() => void subscriptionRes.refetch()}>Check subscription again</button>
          </div>
        ) : !assistantAvailable ? (
          <div className="mt-3 rounded-xl bg-raised/60 p-4">
            <p className="text-sm text-muted">Pico’s Gemini-powered study chat is available to active Pro and Team subscribers.</p>
            <Link href="/billing" className="btn btn-primary mt-3">View plans</Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted mt-1 mb-4">Ask Pico about your lessons and learning path. Pico uses Gemini with your course content and does not create quiz questions.</p>
            <PicoWidget />
            <p className="text-xs text-muted mt-3">Up to 20 messages per hour. Don’t include personal or sensitive information.</p>
          </>
        )}
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="display font-bold">Practice questions from your course</h2>
        <p className="text-xs text-muted mt-1">These questions and choices come directly from the database; Gemini does not generate them.</p>
        {practiceQuestions.length ? (
          <ol className="mt-4 space-y-4 list-decimal pl-5 text-sm">
            {practiceQuestions.map((question) => (
              <li key={question.question_id}>
                <p className="text-text">{question.prompt}</p>
                <p className="text-xs text-muted mt-1">{question.module_title} · {question.quiz_title}</p>
                {question.options.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-3 text-muted">
                    {question.options.map((option, index) => <li key={index}>{String.fromCharCode(65 + index)}. {option}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted mt-2">There are no quiz questions in your upcoming path modules yet.</p>
        )}
      </section>

      <div className="card min-w-0 overflow-hidden p-2 md:p-6">
        <Constellation items={items} onOpen={(n) => router.push(`/lessons/${n.lessonId}?item=${n.itemId}`)} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-2 px-2 pb-2 text-xs text-muted font-mono">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-mint inline-block" /> {done} done</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> current</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-raised border border-line inline-block" /> locked</span>
          <span className="ml-auto">{progress}% complete · pace {Number(data.path.velocity).toFixed(1)} lessons/day</span>
        </div>
      </div>

      <div>
        <SectionTitle title="Sequence" sub="Weakest skills first — completed lessons anchored in place" />
        <div className="space-y-2">
          {items.map((n, i) => (
            <motion.div key={n.itemId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
              className={`card p-4 flex items-center gap-4 ${n.status === "locked" ? "opacity-55" : ""}`}>
              <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${
                n.status === "done" ? "bg-mint/15 text-mint" : n.status === "current" ? "bg-primary/15 text-primary" : "bg-raised text-muted"}`}>
                {n.status === "done" ? <Check size={15} /> : n.status === "locked" ? <Lock size={13} /> : <Play size={13} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{i + 1}. {n.title}</p>
                <p className="text-muted text-xs font-mono mt-0.5">{n.moduleTitle} · {n.estimatedMinutes} min</p>
              </div>
              {n.status !== "locked" ? (
                <Link href={`/lessons/${n.lessonId}?item=${n.itemId}`} className={`btn ${n.status === "current" ? "btn-primary" : "btn-ghost"} !py-1.5 !px-3.5 text-[13px] shrink-0`}>
                  {n.status === "done" ? "Review" : "Start"}
                </Link>
              ) : (
                <span className="tag">unlocks next</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
