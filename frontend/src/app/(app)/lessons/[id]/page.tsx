"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "@/router/navigation";
import Link from "@/router/link";
import { motion } from "framer-motion";
import { ArrowLeft, Award, CheckCheck, Clock } from "lucide-react";
import { SphereLoader } from "@/components/Logo";
import { BadgeModal, type EarnedBadge } from "@/components/BadgeModal";
import { toast } from "@/components/Toasts";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";

type Lesson = {
  id: string; title: string; content: string; estimatedMinutes: number;
  moduleTitle: string; courseTitle: string; courseId: string; skills: string[]; completed: boolean;
};
type ProgressResp = { completed: boolean; certificateCode: string | null; xp: number; level: number; badges: (EarnedBadge | null)[] };

// Lightweight markdown-ish renderer for the seeded lesson content: headings, ``` blocks, inline code.
function renderContent(content: string) {
  const parts = content.split(/```(\w*)\n?/);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    const text = parts[i] ?? "";
    text.split(/\n\n+/).forEach((para, j) => {
      const t = para.trim();
      if (!t) return;
      out.push(
        <p key={`p${i}-${j}`} className="text-[15px] leading-[1.75] text-text/90 mb-4" dangerouslySetInnerHTML={{
          __html: t
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/`([^`]+)`/g, '<code class="font-mono text-[13px] bg-raised px-1.5 py-0.5 rounded text-mint">$1</code>'),
        }} />
      );
    });
    if (i + 2 < parts.length) {
      out.push(
        <pre key={`c${i}`} className="monaco-wrap bg-[#0d1024] p-4 my-5 overflow-x-auto">
          <code className="font-mono text-[13px] leading-relaxed text-[#c9d1ff]">{parts[i + 2]}</code>
        </pre>
      );
      i += 2;
    }
  }
  return out;
}

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const itemId = search.get("item");
  const courseId = search.get("course");
  const router = useRouter();
  const { setUser } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [cert, setCert] = useState<string | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
    (async () => {
      const res = await api.get<Lesson>(`/api/v1/lessons/${id}`);
      if (res.success) setLesson(res.data);
      else setNotFound(true);
    })();
  }, [id]);

  if (notFound) {
    return <div className="text-center py-20"><p className="text-muted">Lesson not found.</p><Link href="/path" className="link text-sm">Back to path</Link></div>;
  }
  if (!lesson) return <SphereLoader label="Loading lesson" />;

  const complete = async () => {
    if (!itemId && !courseId) { toast.err("Open this lesson from your course or learning path to record progress."); return; }
    setBusy(true);
    const timeSpentSec = Math.round((Date.now() - startRef.current) / 1000);
    const res = courseId
      ? await api.post<ProgressResp>("/api/v1/course-progress", { courseId, lessonId: id, timeSpentSec })
      : await api.post<ProgressResp>("/api/v1/learning-path/progress", { itemId, timeSpentSec });
    setBusy(false);
    if (!res.success) { toast.err(res.message); return; }
    toast.ok(res.message);
    const earned = (res.data.badges ?? []).filter(Boolean) as EarnedBadge[];
    if (earned.length) setBadges(earned);
    if (res.data.certificateCode) setCert(res.data.certificateCode);
    const me = await api.get<{ user: Parameters<typeof setUser>[0] }>("/api/v1/auth/me");
    if (me.success) setUser(me.data.user);
    setLesson({ ...lesson, completed: true });
  };

  return (
    <div className="max-w-3xl">
      {badges.length > 0 && <BadgeModal badges={badges} onClose={() => setBadges(badges.slice(1))} />}
      {cert && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5 mb-6 border-amber/50 flex items-center gap-4" style={{ background: "linear-gradient(90deg, rgba(255,194,77,.12), transparent)" }}>
          <Award size={20} className="text-amber shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Certificate issued for this course</p>
            <p className="text-muted text-xs font-mono mt-0.5">{cert}</p>
          </div>
          <Link href={`/verify/${cert}`} className="btn btn-primary !py-2 text-[13px] shrink-0">View</Link>
        </motion.div>
      )}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-muted text-sm hover:text-text transition-colors mb-6">
        <ArrowLeft size={15} /> Back
      </button>
      <p className="eyebrow">{lesson.courseTitle} · {lesson.moduleTitle}</p>
      <h1 className="display text-[clamp(26px,4vw,36px)] font-extrabold tracking-tight mt-2 leading-tight">{lesson.title}</h1>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <span className="tag"><Clock size={11} /> {lesson.estimatedMinutes} min</span>
        {lesson.skills.map((sk) => <span key={sk} className="tag">{sk}</span>)}
        {lesson.completed && <span className="tag !text-mint !border-mint/40"><CheckCheck size={11} /> completed</span>}
      </div>
      <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mt-8">
        {renderContent(lesson.content)}
      </motion.article>
      <div className="sticky bottom-5 mt-10">
        <div className="card p-4 flex items-center justify-between gap-4 shadow-2xl">
          <p className="text-sm text-muted">{lesson.completed ? "Marked complete." : "Read through, work the code sample, then mark it done."}</p>
          {lesson.completed ? (
            <Link href={courseId ? `/courses/${courseId}` : "/path"} className="btn btn-primary">{courseId ? "Back to course" : "Continue path"}</Link>
          ) : (
            <button className="btn btn-primary" onClick={complete} disabled={busy || (!itemId && !courseId)}>
              {busy ? "Saving…" : <><CheckCheck size={15} /> Mark complete · +40 XP</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
