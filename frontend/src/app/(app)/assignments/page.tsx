"use client";
import { useState } from "react";
import Link from "@/router/link";
import { ChevronDown, ChevronUp, ClipboardCheck, Clock3, Code2 } from "lucide-react";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { SphereLoader } from "@/components/Logo";
import { useRequireAuth } from "@/components/Shell";
import { useApi } from "@/lib/hooks";
import { api } from "@/lib/api";

type Attempt = { id: string; score: number | string; passedCount: number; totalCount: number; isLate: boolean; submittedAt: string };

type AssignmentsResponse = {
  assignments: {
    id: string;
    exerciseId: string;
    title: string;
    instructions: string;
    dueAt: string | null;
    isOverdue: boolean;
    course: string;
    prompt: string;
    language: string;
    attemptCount: number;
    bestScore: number | string | null;
    latestScore: number | string | null;
    latestPassed: number | null;
    latestTotal: number | null;
    lastSubmittedAt: string | null;
    lastAttemptLate: boolean | null;
  }[];
};

const scoreNumber = (value: number | string | null) => value === null ? null : Number(value);

export default function AssignmentsPage() {
  const { ready } = useRequireAuth("student");
  const { data, error, loading, refetch } = useApi<AssignmentsResponse>(ready ? "/api/v1/coding-assignments" : null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [historyErrors, setHistoryErrors] = useState<Record<string, string>>({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);

  const toggleHistory = async (assignmentId: string) => {
    if (expandedId === assignmentId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(assignmentId);
    if (attempts[assignmentId]) return;
    setLoadingHistory(assignmentId);
    const result = await api.get<{ attempts: Attempt[] }>(`/api/v1/coding-assignments/${assignmentId}`);
    setLoadingHistory(null);
    if (!result.success) {
      setHistoryErrors((previous) => ({ ...previous, [assignmentId]: result.message }));
      return;
    }
    setAttempts((previous) => ({ ...previous, [assignmentId]: result.data.attempts }));
    setHistoryErrors((previous) => ({ ...previous, [assignmentId]: "" }));
  };

  if (!ready || loading) return <SphereLoader label="Loading assignments" />;

  const assignments = data?.assignments ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Coding assignments" sub="Solve instructor-assigned challenges in the editor. Your code is checked against visible and private tests, and every submission is saved." />
      {error && (
        <div className="card p-4 flex items-center justify-between gap-4">
          <p className="text-coral text-sm">{error}</p>
          <button onClick={() => void refetch()} className="btn btn-ghost !py-1.5">Retry</button>
        </div>
      )}
      <SectionTitle title="Your work" sub={`${assignments.length} published assignment${assignments.length === 1 ? "" : "s"}`} />
      {assignments.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={20} />} title="No coding assignments yet" body="When an instructor publishes an assignment for one of your courses, it will appear here." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {assignments.map((assignment) => {
            const latest = scoreNumber(assignment.latestScore);
            const best = scoreNumber(assignment.bestScore);
            return (
              <article key={assignment.id} className="card p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">{assignment.course}</p>
                    <h2 className="display font-bold text-lg mt-1">{assignment.title}</h2>
                  </div>
                  <Code2 size={17} className="text-primary shrink-0 mt-1" />
                </div>
                <p className="text-muted text-sm leading-relaxed mt-3 line-clamp-3">{assignment.instructions || assignment.prompt}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-mono text-muted">
                  {assignment.dueAt ? (
                    <span className={`flex items-center gap-1.5 ${assignment.isOverdue ? "text-coral" : ""}`}>
                      <Clock3 size={12} /> Due {new Date(assignment.dueAt).toLocaleString()}
                    </span>
                  ) : <span>No due date</span>}
                  <span>{assignment.attemptCount} submission{assignment.attemptCount === 1 ? "" : "s"}</span>
                </div>
                {latest !== null && (
                  <div className="mt-4 rounded-xl bg-raised px-3.5 py-3 flex items-center justify-between text-sm">
                    <span>Latest <span className="font-mono">{latest}%{assignment.latestPassed !== null && assignment.latestTotal !== null ? ` Â· ${assignment.latestPassed}/${assignment.latestTotal} tests` : ""}</span></span>
                    <span className={best === 100 ? "text-mint" : "text-muted"}>Best {best}%</span>
                  </div>
                )}
                {assignment.lastAttemptLate && <p className="text-amber text-xs mt-2">Your latest submission was after the due date.</p>}
                {assignment.attemptCount > 0 && (
                  <div className="mt-4">
                    <button onClick={() => void toggleHistory(assignment.id)} className="text-sm link inline-flex items-center gap-1.5">
                      Attempt history {expandedId === assignment.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedId === assignment.id && (
                      <div className="mt-2 rounded-xl bg-raised p-3 space-y-2">
                        {loadingHistory === assignment.id && <p className="text-muted text-xs">Loading attemptsâ€¦</p>}
                        {historyErrors[assignment.id] && <p className="text-coral text-xs">{historyErrors[assignment.id]}</p>}
                        {[...(attempts[assignment.id] ?? [])].reverse().map((attempt, index) => (
                          <div key={attempt.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-muted">Attempt {assignment.attemptCount - index} Â· {new Date(attempt.submittedAt).toLocaleString()}{attempt.isLate ? " Â· late" : ""}</span>
                            <span className="font-mono">{Number(attempt.score)}% Â· {attempt.passedCount}/{attempt.totalCount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-auto pt-5">
                  <Link href={`/playground?assignment=${assignment.id}`} className="btn btn-primary w-full justify-center !py-2.5">
                    {latest === null ? "Start assignment" : "Continue assignment"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
