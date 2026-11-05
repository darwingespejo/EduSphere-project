"use client";
import { useState, type FormEvent } from "react";
import Link from "@/router/link";
import { useParams } from "@/router/navigation";
import { Award, BookOpen, CheckCircle2, Download, GraduationCap, LockKeyhole } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui";
import { SphereLoader } from "@/components/Logo";
import { toast } from "@/components/Toasts";
import ModuleQuizActivity from "@/components/ModuleQuizActivity";
import { useRequireAuth } from "@/components/Shell";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/store";

type CourseDetail = {
  course: { id: string; title: string; description: string; level: string; instructor: string };
  enrolled: boolean;
  modules: {
    id: string; title: string; position: number;
    lessons: { id: string; title: string; estimatedMinutes: number; completed: boolean }[];
    materials: { id: string; name: string; contentType: string; bytes: number }[];
    quizzes: {
      id: string; title: string; questionCount: number; bestScore: number | null; attempts: number;
      questions: { id: string; type: "multiple_choice" | "identification"; prompt: string; options: string[]; points: number }[];
    }[];
  }[];
  requirements: {
    lessonsDone: boolean; lessonsCompleted: number; lessonsTotal: number;
    assignmentsDone: boolean; assignmentsPassed: number; assignmentsTotal: number;
    finalAssessmentDone: boolean; certificateCode: string | null;
  };
  finalAssessment: null | {
    id: string; title: string; passScore: number;
    questions: { id: string; prompt: string; options: string[]; points: number }[];
    bestScore: number | null; passed: boolean;
  };
};

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useRequireAuth();
  const { user } = useAuth();
  const data = useApi<CourseDetail>(ready ? `/api/v1/courses/${id}` : null);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [assessmentMessage, setAssessmentMessage] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const enroll = async () => {
    setBusy(true);
    const result = await api.post(`/api/v1/courses/${id}/enroll`);
    setBusy(false);
    if (!result.success) { toast.err(result.message); return; }
    toast.ok(result.message);
    void data.refetch();
  };
  const submitAssessment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const assessment = data.data?.finalAssessment;
    if (!assessment) return;
    if (assessment.questions.some((question) => answers[question.id] === undefined)) {
      toast.err("Answer every question before submitting.");
      return;
    }
    setBusy(true);
    const result = await api.post<{ score: number; passed: boolean; certificateCode: string | null }>(
      `/api/v1/courses/${id}/final-assessment`,
      { answers: assessment.questions.map((question) => ({ questionId: question.id, selectedOption: answers[question.id] })) },
    );
    setBusy(false);
    setAssessmentMessage(result.message);
    if (!result.success) { toast.err(result.message); return; }
    toast.ok(result.message);
    void data.refetch();
  };
  const downloadMaterial = async (materialId: string) => {
    setDownloadError("");
    try {
      const { blob, filename } = await api.download(`/api/v1/course-materials/${materialId}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not download course material.");
    }
  };

  if (!ready || data.loading) return <SphereLoader label="Loading course" />;
  if (data.error || !data.data) return <div className="card p-5 text-coral">{data.error ?? "Course not found."}</div>;
  const { course, enrolled, modules, requirements, finalAssessment } = data.data;
  const instructor = user?.role === "instructor" || user?.role === "admin";

  return (
    <div className="space-y-7">
      <PageHeader title={course.title} sub={`${course.level} · Instructor ${course.instructor}`} />
      <p className="max-w-4xl text-muted leading-relaxed">{course.description}</p>
      {instructor && user?.role === "instructor" && (
        <Link href="/instructor/courses" className="btn btn-ghost">Open course builder</Link>
      )}
      {!instructor && !enrolled && (
        <section className="card p-5 flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="font-semibold">Start learning</h2><p className="text-sm text-muted mt-1">Enroll to unlock lessons, downloads, and assignments.</p></div>
          <button className="btn btn-primary" disabled={busy} onClick={enroll}>{busy ? "Enrolling…" : "Enroll in course"}</button>
        </section>
      )}

      {enrolled && (
        <section className="card p-5">
          <SectionTitle title="Certificate progress" sub="Complete every lesson, pass every published coding assignment, and pass the final assessment." right={<Award size={17} className="text-amber" />} />
          <div className="grid sm:grid-cols-3 gap-3 mt-5">
            {[
              ["Lessons", requirements.lessonsDone, `${requirements.lessonsCompleted}/${requirements.lessonsTotal} complete`],
              ["Coding assignments", requirements.assignmentsDone, `${requirements.assignmentsPassed}/${requirements.assignmentsTotal} passed`],
              ["Final assessment", requirements.finalAssessmentDone, requirements.finalAssessmentDone ? "Passed" : "Not passed"],
            ].map(([label, done, detail]) => (
              <div key={String(label)} className="rounded-xl border border-line p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">{done ? <CheckCircle2 size={15} className="text-mint" /> : <LockKeyhole size={15} className="text-muted" />}{label}</p>
                <p className="text-xs text-muted mt-1">{detail}</p>
              </div>
            ))}
          </div>
          {requirements.certificateCode && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/40 p-4">
              <p className="font-mono text-sm">Certificate {requirements.certificateCode}</p>
              <Link className="btn btn-primary !py-2" href={`/verify/${requirements.certificateCode}`}>View certificate</Link>
            </div>
          )}
        </section>
      )}

      {enrolled && (
        <section className="space-y-4">
          <SectionTitle title="Course modules" sub="Work through each module in sequence. Materials are available from their module." right={<BookOpen size={17} className="text-primary" />} />
          {downloadError && <p role="alert" className="text-coral text-sm">{downloadError}</p>}
          {!modules.length && <p className="card p-5 text-sm text-muted">This course does not have any modules yet.</p>}
          {modules.map((module, index) => (
            <article key={module.id} className="card p-5">
              <h2 className="display font-bold">{index + 1}. {module.title}</h2>
              <div className="mt-4 space-y-2">
                {module.lessons.map((lesson) => (
                  <Link key={lesson.id} href={`/lessons/${lesson.id}?course=${course.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 hover:border-primary/50">
                    <span className="flex items-center gap-2 text-sm">{lesson.completed ? <CheckCircle2 size={15} className="text-mint" /> : <BookOpen size={15} className="text-muted" />}{lesson.title}</span>
                    <span className="text-xs text-muted">{lesson.estimatedMinutes} min</span>
                  </Link>
                ))}
                {module.materials.map((material) => (
                  <button key={material.id} type="button" onClick={() => void downloadMaterial(material.id)} className="w-full flex items-center justify-between gap-3 rounded-lg bg-raised px-3 py-2.5 text-sm hover:text-primary">
                    <span className="flex items-center gap-2"><Download size={14} />{material.name}</span>
                    <span className="text-xs text-muted">{Math.max(1, Math.ceil(material.bytes / 1024))} KB</span>
                  </button>
                ))}
                {module.quizzes.map((quiz) => (
                  <ModuleQuizActivity key={quiz.id} quiz={quiz} onAttemptSaved={() => void data.refetch()} />
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {enrolled && finalAssessment && (
        <section className="card p-5 md:p-7">
          <SectionTitle title={finalAssessment.title} sub={`Pass score: ${finalAssessment.passScore}%${finalAssessment.bestScore === null ? "" : ` · Best: ${finalAssessment.bestScore}%`}`} right={<GraduationCap size={17} className="text-primary" />} />
          {finalAssessment.passed ? (
            <p className="text-mint text-sm mt-4">Final assessment passed. Your course progress has been updated.</p>
          ) : (
            <form onSubmit={submitAssessment} className="mt-5 space-y-6">
              {finalAssessment.questions.map((question, index) => (
                <fieldset key={question.id} className="space-y-2">
                  <legend className="text-sm font-semibold">{index + 1}. {question.prompt}</legend>
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="flex items-center gap-2 text-sm text-muted">
                      <input type="radio" name={question.id} checked={answers[question.id] === optionIndex}
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} />
                      {option}
                    </label>
                  ))}
                </fieldset>
              ))}
              {assessmentMessage && <p className="text-sm text-muted">{assessmentMessage}</p>}
              <button className="btn btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit final assessment"}</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
