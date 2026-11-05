"use client";
import { useState, type FormEvent } from "react";
import Link from "@/router/link";
import { BookOpen, ClipboardList, FileUp, Plus, Send, Trash2 } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui";
import { SphereLoader } from "@/components/Logo";
import { toast } from "@/components/Toasts";
import { useRequireAuth } from "@/components/Shell";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";

type Course = { id: string; title: string; published: boolean };
type CourseDetail = {
  course: { id: string; title: string };
  modules: {
    id: string;
    title: string;
    lessons: { id: string; title: string }[];
    materials: { id: string; name: string }[];
    quizzes: { id: string; title: string; questionCount: number; bestScore: number | null; attempts: number }[];
  }[];
};

type QuizQuestionDraft = {
  type: "multiple_choice" | "identification";
  prompt: string;
  options: string[];
  correctOption: number;
  acceptedAnswers: string;
  points: number;
};

const sampleQuestions = JSON.stringify([
  { prompt: "Which layer routes packets between networks?", options: ["Physical", "Network", "Session", "Presentation"], correctOption: 1, points: 1 },
], null, 2);

export default function InstructorCoursesPage() {
  const { ready } = useRequireAuth("instructor");
  const courses = useApi<Course[]>(ready ? "/api/v1/courses" : null);
  const [courseId, setCourseId] = useState("");
  const selectedCourseId = courseId || courses.data?.[0]?.id || "";
  const selectedCourse = courses.data?.find((course) => course.id === selectedCourseId);
  const detail = useApi<CourseDetail>(ready && selectedCourseId ? `/api/v1/courses/${selectedCourseId}` : null);
  const [moduleId, setModuleId] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("beginner");
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(20);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionDraft[]>([{
    type: "multiple_choice",
    prompt: "",
    options: ["", "", "", ""],
    correctOption: 0,
    acceptedAnswers: "",
    points: 1,
  }]);
  const [assessmentTitle, setAssessmentTitle] = useState("Final assessment");
  const [passScore, setPassScore] = useState(80);
  const [questionsJson, setQuestionsJson] = useState(sampleQuestions);
  const [busy, setBusy] = useState(false);

  const selectedModuleId = detail.data?.modules.some((module) => module.id === moduleId)
    ? moduleId
    : detail.data?.modules[0]?.id ?? "";

  const createCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const result = await api.post<{ id: string }>("/api/v1/courses", { title: courseTitle, description, level });
    setBusy(false);
    if (!result.success) { toast.err(result.message); return; }
    toast.ok(result.message);
    setCourseTitle("");
    setDescription("");
    setCourseId(result.data.id);
    void courses.refetch();
  };
  const createModule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourseId) return;
    setBusy(true);
    const result = await api.post<{ id: string }>(`/api/v1/courses/${selectedCourseId}/modules`, { title: moduleTitle });
    setBusy(false);
    if (!result.success) { toast.err(result.message); return; }
    toast.ok(result.message);
    setModuleTitle("");
    setModuleId(result.data.id);
    void detail.refetch();
  };
  const createLesson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedModuleId) return;
    setBusy(true);
    const result = await api.post(`/api/v1/modules/${selectedModuleId}/lessons`, { title: lessonTitle, content: lessonContent, estimatedMinutes });
    setBusy(false);
    if (!result.success) { toast.err(result.message); return; }
    toast.ok(result.message);
    setLessonTitle("");
    setLessonContent("");
    void detail.refetch();
  };
  const createQuiz = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedModuleId) return;
    const questions = quizQuestions.map((question) => question.type === "multiple_choice"
      ? {
          type: question.type,
          prompt: question.prompt,
          options: question.options,
          correctOption: question.correctOption,
          points: question.points,
        }
      : {
          type: question.type,
          prompt: question.prompt,
          acceptedAnswers: question.acceptedAnswers.split("\n").map((answer) => answer.trim()).filter(Boolean),
          points: question.points,
        });
    setBusy(true);
    const result = await api.post<{ id: string }>(`/api/v1/modules/${selectedModuleId}/quizzes`, {
      title: quizTitle,
      questions,
    });
    setBusy(false);
    if (!result.success) { toast.err(result.message); return; }
    toast.ok(result.message);
    setQuizTitle("");
    setQuizQuestions([{
      type: "multiple_choice",
      prompt: "",
      options: ["", "", "", ""],
      correctOption: 0,
      acceptedAnswers: "",
      points: 1,
    }]);
    void detail.refetch();
  };
  const uploadMaterial = async (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !selectedModuleId) return;
    const body = new FormData();
    body.set("file", file);
    setBusy(true);
    const result = await api.upload(`/api/v1/modules/${selectedModuleId}/materials`, body);
    setBusy(false);
    input.value = "";
    if (!result.success) { toast.err(result.message); return; }
    toast.ok(result.message);
    void detail.refetch();
  };
  const saveAssessment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourseId) return;
    let questions: unknown;
    try { questions = JSON.parse(questionsJson); } catch {
      toast.err("Assessment questions must be valid JSON.");
      return;
    }
    setBusy(true);
    const result = await api.put(`/api/v1/courses/${selectedCourseId}/final-assessment`, {
      title: assessmentTitle, passScore, questions,
    });
    setBusy(false);
    if (!result.success) { toast.err(result.message); return; }
    toast.ok(result.message);
    void detail.refetch();
  };
  const togglePublished = async (course: Course) => {
    setBusy(true);
    const result = await api.patch(`/api/v1/courses/${course.id}`, { published: !course.published });
    setBusy(false);
    if (!result.success) { toast.err(result.message); return; }
    toast.ok(result.message);
    void courses.refetch();
  };

  if (!ready || courses.loading) return <SphereLoader label="Loading course builder" />;

  return (
    <div className="space-y-7">
      <PageHeader title="Course builder" sub="Create a structured curriculum, add lessons and downloadable resources, configure its final assessment, then publish it to students." />
      {courses.error && <div role="alert" className="card p-4 text-coral text-sm">{courses.error}</div>}
      <section className="card p-5 md:p-7">
        <SectionTitle title="Create a course" sub="New courses start as private drafts." right={<Plus size={16} className="text-primary" />} />
        <form onSubmit={createCourse} className="mt-5 grid md:grid-cols-2 gap-4">
          <label className="text-sm font-medium">Course title
            <input className="input mt-1.5" value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} minLength={3} maxLength={160} required />
          </label>
          <label className="text-sm font-medium">Level
            <select className="input mt-1.5" value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="text-sm font-medium md:col-span-2">Description
            <textarea className="input mt-1.5 min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={5000} required />
          </label>
          <div className="md:col-span-2 flex justify-end"><button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create course draft"}</button></div>
        </form>
      </section>

      {courses.data?.length ? (
        <>
          <section className="card p-5 md:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <label className="text-sm font-medium flex-1 min-w-60">Edit a course
                <select className="input mt-1.5" value={selectedCourseId} onChange={(event) => { setCourseId(event.target.value); setModuleId(""); }}>
                  {courses.data.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                </select>
              </label>
              {selectedCourse && (selectedCourse.published
                ? <button className="btn btn-ghost" disabled={busy} onClick={() => void togglePublished(selectedCourse)}>Unpublish</button>
                : <button className="btn btn-primary" disabled={busy} onClick={() => void togglePublished(selectedCourse)}><Send size={14} /> Publish</button>)}
            </div>
            <p className="text-xs text-muted mt-3">Publishing requires at least one lesson, one published coding assignment, and one final-assessment question. <Link className="link" href="/instructor/assignments">Manage coding assignments</Link>.</p>
          </section>
          {detail.loading ? <SphereLoader label="Loading course contents" /> : detail.error ? <div role="alert" className="card p-4 text-coral text-sm">{detail.error}</div> : (
            <div className="grid xl:grid-cols-2 gap-5">
              <div className="space-y-5">
                <section className="card p-5">
                  <SectionTitle title="Modules" sub="Arrange your content into focused units." right={<BookOpen size={16} className="text-primary" />} />
                  <form onSubmit={createModule} className="mt-4 flex gap-2">
                    <input className="input" placeholder="Module title" value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} minLength={2} maxLength={160} required />
                    <button className="btn btn-primary shrink-0" disabled={busy || !selectedCourseId}>Add module</button>
                  </form>
                  <div className="mt-4 space-y-2">
                    {detail.data?.modules.map((module) => (
                      <button key={module.id} onClick={() => setModuleId(module.id)} className={`w-full rounded-lg border p-3 text-left ${module.id === selectedModuleId ? "border-primary/50 bg-primary/5" : "border-line"}`}>
                        <span className="font-medium text-sm">{module.title}</span>
                        <span className="block text-xs text-muted mt-1">{module.lessons.length} lessons · {module.materials.length} materials · {module.quizzes.length} quizzes</span>
                      </button>
                    ))}
                    {!detail.data?.modules.length && <p className="text-sm text-muted">Add your first module to begin.</p>}
                  </div>
                </section>
                <section className="card p-5">
                  <SectionTitle title="Add a lesson" sub="Text supports headings, inline code, and fenced code blocks." />
                  <form onSubmit={createLesson} className="mt-4 space-y-3">
                    <label className="text-sm font-medium">Module
                      <select className="input mt-1.5" value={selectedModuleId} onChange={(event) => setModuleId(event.target.value)} required>
                        {detail.data?.modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
                      </select>
                    </label>
                    <input className="input" placeholder="Lesson title" value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} minLength={2} maxLength={160} required />
                    <textarea className="input min-h-48 font-mono text-xs" placeholder={"## Learning objectives\n\nExplain the concept...\n\n```js\nconst example = true;\n```"} value={lessonContent} onChange={(event) => setLessonContent(event.target.value)} minLength={10} maxLength={500000} required />
                    <div className="flex items-end justify-between gap-3">
                      <label className="text-sm">Estimated minutes<input className="input mt-1" type="number" min={1} max={600} value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(Number(event.target.value))} /></label>
                      <button className="btn btn-primary" disabled={busy || !selectedModuleId}>Add lesson</button>
                    </div>
                  </form>
                </section>
                <section className="card p-5">
                  <SectionTitle title="Course materials" sub="PDF, PowerPoint, Word, Excel, CSV, text, images, and ZIP · 25 MB maximum." right={<FileUp size={16} className="text-primary" />} />
                  <label className={`btn btn-ghost mt-4 ${!selectedModuleId || busy ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
                    Choose file to upload
                    <input className="sr-only" type="file" disabled={!selectedModuleId || busy} onChange={(event) => void uploadMaterial(event)} />
                  </label>
                  {!selectedModuleId && <p className="text-xs text-muted mt-2">Create or select a module before uploading.</p>}
                </section>
                <section className="card p-5">
                  <SectionTitle title="Add a quiz activity" sub="Students can take multiple-choice and identification questions in this module." right={<ClipboardList size={16} className="text-primary" />} />
                  <form onSubmit={createQuiz} className="mt-4 space-y-4">
                    <label className="block text-sm font-medium">Module
                      <select className="input mt-1.5" value={selectedModuleId} onChange={(event) => setModuleId(event.target.value)} required>
                        {detail.data?.modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-medium">Quiz title
                      <input className="input mt-1.5" value={quizTitle} onChange={(event) => setQuizTitle(event.target.value)} minLength={3} maxLength={160} required />
                    </label>
                    {quizQuestions.map((question, questionIndex) => (
                      <fieldset key={questionIndex} className="rounded-xl border border-line p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <legend className="text-sm font-semibold">Question {questionIndex + 1}</legend>
                          {quizQuestions.length > 1 && (
                            <button type="button" className="btn btn-ghost !p-2" aria-label={`Remove question ${questionIndex + 1}`}
                              onClick={() => setQuizQuestions((current) => current.filter((_, index) => index !== questionIndex))}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <label className="block text-sm">Question type
                          <select className="input mt-1" value={question.type} onChange={(event) => {
                            const type = event.target.value as QuizQuestionDraft["type"];
                            setQuizQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, type } : item));
                          }}>
                            <option value="multiple_choice">Multiple choice</option>
                            <option value="identification">Identification</option>
                          </select>
                        </label>
                        <label className="block text-sm">Prompt
                          <textarea className="input mt-1 min-h-20" value={question.prompt} onChange={(event) => {
                            setQuizQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, prompt: event.target.value } : item));
                          }} minLength={5} maxLength={2000} required />
                        </label>
                        {question.type === "multiple_choice" ? (
                          <div className="space-y-2">
                            <p className="text-xs text-muted">Select the radio button beside the correct option.</p>
                            {question.options.map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center gap-2">
                                <input type="radio" name={`correct-${questionIndex}`} aria-label={`Option ${optionIndex + 1} is correct`}
                                  checked={question.correctOption === optionIndex}
                                  onChange={() => setQuizQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, correctOption: optionIndex } : item))} />
                                <input className="input" aria-label={`Question ${questionIndex + 1}, option ${optionIndex + 1}`}
                                  placeholder={`Option ${optionIndex + 1}`} value={option} maxLength={500} required
                                  onChange={(event) => setQuizQuestions((current) => current.map((item, index) => index === questionIndex
                                    ? { ...item, options: item.options.map((value, choiceIndex) => choiceIndex === optionIndex ? event.target.value : value) }
                                    : item))} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <label className="block text-sm">Accepted answers (one per line)
                            <textarea className="input mt-1 min-h-20" value={question.acceptedAnswers} placeholder={"Example answer\nAlternative answer"} required
                              onChange={(event) => setQuizQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, acceptedAnswers: event.target.value } : item))} />
                          </label>
                        )}
                        <label className="block text-sm">Points
                          <input className="input mt-1 w-28" type="number" min={1} max={100} value={question.points}
                            onChange={(event) => setQuizQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, points: Number(event.target.value) } : item))} />
                        </label>
                      </fieldset>
                    ))}
                    <div className="flex flex-wrap justify-between gap-3">
                      <button type="button" className="btn btn-ghost" disabled={quizQuestions.length >= 50}
                        onClick={() => setQuizQuestions((current) => [...current, {
                          type: "multiple_choice",
                          prompt: "",
                          options: ["", "", "", ""],
                          correctOption: 0,
                          acceptedAnswers: "",
                          points: 1,
                        }])}>
                        <Plus size={14} /> Add question
                      </button>
                      <button className="btn btn-primary" disabled={busy || !selectedModuleId}>
                        {busy ? "Saving…" : "Add quiz to module"}
                      </button>
                    </div>
                  </form>
                  {selectedModuleId && detail.data?.modules.find((module) => module.id === selectedModuleId)?.quizzes.length ? (
                    <div className="mt-5 border-t border-line pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Quizzes in this module</p>
                      <ul className="mt-2 space-y-2">
                        {detail.data.modules.find((module) => module.id === selectedModuleId)?.quizzes.map((quiz) => (
                          <li key={quiz.id} className="flex justify-between gap-3 text-sm">
                            <span>{quiz.title}</span><span className="text-muted">{quiz.questionCount} questions</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              </div>
              <div className="space-y-5">
                <section className="card p-5">
                  <SectionTitle title="Final assessment" sub="Four-option multiple choice questions. Correct answers remain private." right={<ClipboardList size={16} className="text-primary" />} />
                  <form onSubmit={saveAssessment} className="mt-4 space-y-3">
                    <input className="input" value={assessmentTitle} onChange={(event) => setAssessmentTitle(event.target.value)} minLength={3} maxLength={160} required />
                    <label className="text-sm">Passing score (%)
                      <input className="input mt-1.5" type="number" value={passScore} min={50} max={100} onChange={(event) => setPassScore(Number(event.target.value))} />
                    </label>
                    <label className="text-sm">Questions (JSON)
                      <textarea className="input mt-1.5 min-h-[360px] font-mono text-xs" value={questionsJson} onChange={(event) => setQuestionsJson(event.target.value)} spellCheck={false} required />
                    </label>
                    <p className="text-xs text-muted">Each item needs a prompt, exactly four options, a zero-based correctOption (0-3), and optional points.</p>
                    <div className="flex justify-end"><button className="btn btn-primary" disabled={busy || !selectedCourseId}>Save final assessment</button></div>
                  </form>
                </section>
                <section className="card p-5">
                  <SectionTitle title="Student code review" sub="See the exact source code submitted for each coding assignment attempt." />
                  <p className="text-sm text-muted mt-3">Code is stored exactly as submitted. The platform does not determine whether it was typed or pasted.</p>
                  <Link href="/instructor/assignments" className="btn btn-ghost mt-4">Open coding assignments</Link>
                </section>
              </div>
            </div>
          )}
        </>
      ) : (
        <section className="card p-6 text-sm text-muted">Your courses will appear here after you create one or an administrator assigns it to you.</section>
      )}
    </div>
  );
}
