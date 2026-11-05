"use client";
import Link from "@/router/link";
import { motion } from "framer-motion";
import { Activity, ArrowRight, ArrowUpRight, BookOpen, Flame, PenLine, Play, Sparkles, Target, Waypoints, type LucideIcon } from "lucide-react";
import { SphereLoader } from "@/components/Logo";
import { CountUp, PageHeader, Ring, SkillBar, StatCard } from "@/components/ui";
import { Radar } from "@/components/Charts";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/store";
import type { PathNode } from "@/components/Constellation";

type Analytics = {
  xp: number; level: number; nextLevelXp: number;
  streak: { current: number; longest: number };
  mastery: { skill: string; score: number }[];
  path: { done: number; total: number };
  minutesSpent: number; velocity: number; runs: number; badgesCount: number; reviewsGiven: number;
};
type PathData = { path: { rationale: string } | null; items?: PathNode[]; hasPlacement?: boolean };
type QueueItem = { assignmentId: string; status: string };

export default function DashboardPage() {
  const { user } = useAuth();
  const an = useApi<Analytics>("/api/v1/analytics/student");
  const path = useApi<PathData>("/api/v1/learning-path");
  const queue = useApi<QueueItem[]>("/api/v1/peer-review/queue");

  if (an.loading || path.loading) return <SphereLoader label="Loading your dashboard" />;
  const a = an.data;
  if (!a) return <p className="text-muted">Could not load the dashboard: {an.error}</p>;

  const pctToNext = Math.min(100, Math.round((a.xp / a.nextLevelXp) * 100));
  const pendingReviews = (queue.data ?? []).filter((q) => q.status === "pending").length;
  const nextItems = (path.data?.items ?? []).filter((i) => i.status === "current").slice(0, 3);
  const hasPath = !!path.data?.path;
  const gaps = [...a.mastery].sort((x, y) => x.score - y.score).slice(0, 4);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={`Back in orbit, ${user?.name.split(" ")[0]}.`}
        sub={hasPath ? (path.data?.path?.rationale ?? "") : "No learning path yet — the placement assessment creates one in about 5 minutes."}
      />

      <div className="card relative isolate overflow-hidden bg-gradient-to-br from-primary/10 via-surface to-mint/10 p-5 shadow-[0_18px_48px_-32px_var(--primary)] md:p-7">
        <div aria-hidden="true" className="glow-blob -left-8 -top-12 h-36 w-36 bg-primary/20" />
        <div aria-hidden="true" className="glow-blob -right-8 -top-16 h-40 w-40 bg-mint/20" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary via-primary/70 to-mint p-[3px] shadow-lg">
              <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-surface text-xl font-bold text-primary">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <span aria-label={user?.name ?? "Student"}>
                    {user?.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="eyebrow">Your learning space</p>
              <h2 className="display mt-1 text-2xl font-bold md:text-3xl">{user?.name}</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{user?.bio ?? "Building momentum, one lesson at a time."}</p>
            </div>
          </div>
          <Link href="/profile" className="btn btn-ghost !rounded-2xl !py-2.5">Edit profile</Link>
        </div>
      </div>

      {pendingReviews > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card flex items-center justify-between gap-4 border-primary/40 p-4 md:p-5"
          style={{ background: "linear-gradient(90deg, var(--glow-primary), transparent 65%)" }}>
          <div className="flex items-center gap-3">
            <PenLine size={17} className="text-primary shrink-0" />
            <p className="text-sm"><span className="font-semibold">{pendingReviews} anonymous submission{pendingReviews > 1 ? "s" : ""}</span> waiting for your review. Reviews pay 50 XP.</p>
          </div>
          <Link href="/review" className="btn btn-primary !py-1.5 !px-3.5 text-[13px] shrink-0">Open queue</Link>
        </motion.div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="XP — level" value={<span className="flex items-center gap-3">
          <Ring value={pctToNext} size={54} stroke={6} label={<span className="font-mono text-[11px]">{a.level}</span>} />
          <CountUp value={a.xp} />
        </span>} sub={`${pctToNext}% to level ${a.level + 1}`} />
        <StatCard label="Streak" accent="var(--amber)" value={
          <span className="flex items-center gap-2"><Flame size={24} className="text-amber" fill="currentColor" /><CountUp value={a.streak.current} suffix="d" /></span>
        } sub={`longest ${a.streak.longest} days`} />
        <StatCard label="Path progress" accent="var(--mint)" value={
          <span className="flex items-center gap-2"><BookOpen size={22} className="text-mint" /><span>{a.path.done}<span className="text-muted text-base">/{a.path.total}</span></span></span>
        } sub={hasPath ? "lessons complete" : "no path yet"} />
        <StatCard label="Avg mastery" accent="var(--coral)" value={
          <span className="flex items-center gap-2"><Target size={22} className="text-coral" /><CountUp value={a.mastery.length ? Math.round(a.mastery.reduce((s, m) => s + m.score, 0) / a.mastery.length) : 0} suffix="%" /></span>
        } sub={`${a.minutesSpent} min studied`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden border-t-2 border-t-primary/60 bg-gradient-to-br from-primary/5 via-surface to-surface p-5 md:p-6">
          <DashboardSectionTitle icon={Waypoints} accent="var(--primary)" title="Next on your path" right={hasPath && <Link href="/path" className="text-sm link flex items-center gap-1">Full map <ArrowUpRight size={14} /></Link>} />
          {hasPath && nextItems.length > 0 ? (
            <div className="space-y-3">
              {nextItems.map((n, i) => (
                <motion.div key={n.itemId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="card-raise flex items-center justify-between gap-3 p-4 transition-colors hover:border-primary/40">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{n.title}</p>
                    <p className="text-muted text-xs font-mono mt-0.5">{n.moduleTitle} · {n.estimatedMinutes} min</p>
                  </div>
                  <Link href={`/lessons/${n.lessonId}?item=${n.itemId}`} className={`btn ${i === 0 ? "btn-primary" : "btn-ghost"} !py-2 !px-3.5 text-[13px] shrink-0`}>
                    <Play size={13} /> {i === 0 ? "Continue" : "Open"}
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : hasPath ? (
            <EmptyPath done />
          ) : (
            <EmptyPath />
          )}
        </div>

        <div className="card overflow-hidden border-t-2 border-t-mint/60 bg-gradient-to-br from-mint/5 via-surface to-surface p-5 md:p-6">
          <DashboardSectionTitle icon={Sparkles} accent="var(--mint)" title="Skill constellation" sub="Latest measurement per skill" />
          {a.mastery.length >= 3 ? (
            <Radar data={a.mastery} />
          ) : (
            <p className="text-muted text-sm py-6 text-center">Take the placement to light up the constellation.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden border-t-2 border-t-coral/60 bg-gradient-to-br from-coral/5 via-surface to-surface p-5 md:p-6">
          <DashboardSectionTitle icon={Target} accent="var(--coral)" title="Biggest gaps" sub="Lowest scores first — the path opens with these"
            right={<Link href="/assessment" className="text-sm link">Retake placement</Link>} />
          {gaps.length > 0 ? (
            <div className="space-y-4">
              {gaps.map((g) => <SkillBar key={g.skill} name={g.skill} value={g.score} color={g.score < 40 ? "var(--coral)" : "var(--primary)"} />)}
            </div>
          ) : <p className="text-muted text-sm">No measurements yet.</p>}
        </div>
        <div className="card overflow-hidden border-t-2 border-t-amber/60 bg-gradient-to-br from-amber/5 via-surface to-surface p-5 md:p-6">
          <DashboardSectionTitle icon={Activity} accent="var(--amber)" title="This week's throughput" sub="Measured, not estimated" />
          <div className="grid grid-cols-2 gap-4 mt-2">
            {[
              { v: a.velocity, suffix: "", label: "lessons / day (14-day pace)", fmt: (v: number) => v.toFixed(1) },
              { v: a.runs, suffix: "", label: "code runs in sandbox", fmt: Math.round },
              { v: a.reviewsGiven, suffix: "", label: "peer reviews submitted", fmt: Math.round },
              { v: a.badgesCount, suffix: "/8", label: "badges earned", fmt: Math.round },
            ].map((s) => (
              <div key={s.label} className="card-raise p-4 transition-colors hover:border-primary/40">
                <p className="display text-2xl font-bold"><CountUp value={typeof s.fmt === "function" && s.fmt !== Math.round ? Math.round(s.v * 10) / 10 : s.fmt(s.v)} suffix={s.suffix} /></p>
                <p className="text-muted text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyPath({ done = false }: { done?: boolean }) {
  return (
    <div className="border border-dashed border-line rounded-2xl p-8 text-center">
      <p className="font-medium">{done ? "Path complete." : "No path generated yet."}</p>
      <p className="text-muted text-sm mt-1">{done ? "Everything on it is done. Regenerate for a fresh pass or pick a new course." : "The placement assessment builds one from your skill gaps."}</p>
      <Link href={done ? "/path" : "/assessment"} className="btn btn-primary !py-2 mt-5 inline-flex">
        {done ? "Open path" : <>Take the placement <ArrowRight size={14} /></>}
      </Link>
    </div>
  );
}

function DashboardSectionTitle({ icon: Icon, accent, title, sub, right }: {
  icon: LucideIcon; accent: string; title: string; sub?: string; right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border"
          style={{
            color: accent,
            backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${accent} 24%, transparent)`,
          }}
        >
          <Icon size={19} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="display text-[20px] font-bold tracking-tight">{title}</h2>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
