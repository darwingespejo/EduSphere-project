"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "@/router/link";
import { motion } from "framer-motion";
import { Check, Gauge, Lock, Play, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "@/router/navigation";
import { SphereLoader } from "@/components/Logo";
import { Constellation, type PathNode } from "@/components/Constellation";
import { PageHeader, SectionTitle, EmptyState } from "@/components/ui";
import { BadgeModal, type EarnedBadge } from "@/components/BadgeModal";
import { toast } from "@/components/Toasts";
import { useApi } from "@/lib/hooks";
import { api } from "@/lib/api";

type PathData = {
  path: { id: string; rationale: string; velocity: string; status: string } | null;
  items: PathNode[];
  course: { title: string; level: string } | null;
  hasPlacement?: boolean;
  badge?: EarnedBadge | null;
};

function formatAdviceLine(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const markdown = /\*\*(.+?)\*\*|__(.+?)__/g;
  let start = 0;
  let match: RegExpExecArray | null;

  while ((match = markdown.exec(line)) !== null) {
    if (match.index > start) parts.push(line.slice(start, match.index));
    parts.push(<strong key={`${match.index}-bold`} className="text-text">{match[1] ?? match[2]}</strong>);
    start = markdown.lastIndex;
  }

  if (start < line.length) parts.push(line.slice(start));
  return parts;
}

function renderAdvice(text: string) {
  return text.trim().split(/\n{2,}/).filter(Boolean).map((block, index) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const cleanLines = lines.map((line) => line.replace(/^#{1,3}\s+/, "").replace(/^\*\*(.+)\*\*:?\s*$/, "$1"));
    const listItems = cleanLines
      .map((line) => line.match(/^(?:[-*]\s+|\d+[.)]\s+)(.+)$/)?.[1])
      .filter((item): item is string => Boolean(item));

    if (cleanLines.length && listItems.length === cleanLines.length) {
      return (
        <ol key={index} className="list-decimal pl-5 space-y-1.5">
          {listItems.map((item, itemIndex) => <li key={itemIndex}>{formatAdviceLine(item)}</li>)}
        </ol>
      );
    }

    if (cleanLines.length === 1 && /^(Your next steps|Suggested pace)$/i.test(cleanLines[0].replace(/:$/, ""))) {
      return <h3 key={index} className="display font-bold text-text">{cleanLines[0].replace(/:$/, "")}</h3>;
    }

    return (
      <p key={index}>
        {cleanLines.map((line, lineIndex) => (
          <span key={lineIndex}>
            {formatAdviceLine(line)}
            {lineIndex < cleanLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

export default function PathPage() {
  const router = useRouter();
  const pathRes = useApi<PathData>("/api/v1/learning-path");
  const [regenerating, setRegenerating] = useState(false);
  const [badge, setBadge] = useState<EarnedBadge[]>([]);
  const [generating, setGenerating] = useState(false);
  const [coaching, setCoaching] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
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

  const askGemini = async () => {
    setCoaching(true);
    const r = await api.post<{ advice: string }>("/api/v1/learning-path/coach");
    setCoaching(false);
    if (r.success) setAdvice(r.data.advice);
    else toast.err(r.message);
  };

  const progress = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="space-y-8">
      {badge.length > 0 && <BadgeModal badges={badge} onClose={() => setBadge([])} />}
      <PageHeader
        title={data.course ? `${data.course.title} — your orbit` : "My learning path"}
        sub={data.path.rationale}
        actions={
          <>
            <button className="btn btn-ghost" onClick={askGemini} disabled={coaching}>
              <Sparkles size={15} className={coaching ? "animate-pulse" : ""} /> {coaching ? "Asking Gemini…" : "Ask Gemini"}
            </button>
            <button className="btn btn-ghost" onClick={regenerate} disabled={regenerating}>
              <RefreshCw size={15} className={regenerating ? "animate-spin" : ""} /> {regenerating ? "Re-sequencing…" : "Regenerate"}
            </button>
          </>
        }
      />

      {advice && (
        <section className="card p-5 md:p-6" aria-live="polite">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-primary" />
            <h2 className="display font-bold">Your Gemini study coach</h2>
          </div>
          <div className="text-sm leading-relaxed text-muted mt-3 space-y-3">{renderAdvice(advice)}</div>
          <p className="text-xs text-muted mt-4">Generated from your course, path progress, and upcoming lessons. No account details are shared.</p>
        </section>
      )}

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
