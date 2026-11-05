"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardList, RotateCcw, XCircle } from "lucide-react";
import { toast } from "@/components/Toasts";
import { api } from "@/lib/api";

type QuizQuestion = {
  id: string;
  type: "multiple_choice" | "identification";
  prompt: string;
  options: string[];
  points: number;
};

type Quiz = {
  id: string;
  title: string;
  questionCount: number;
  bestScore: number | null;
  attempts: number;
  questions: QuizQuestion[];
};

type QuizResult = {
  score: number;
  earnedPoints: number;
  possiblePoints: number;
  results: {
    questionId: string;
    prompt: string;
    response: string;
    correct: boolean;
    expected: string | string[];
    pointsAwarded: number;
    points: number;
  }[];
};

export default function ModuleQuizActivity({
  quiz,
  onAttemptSaved,
}: {
  quiz: Quiz;
  onAttemptSaved?: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedAnswers = quiz.questions.map((question) => {
      const answer = answers[question.id];
      return question.type === "multiple_choice"
        ? { questionId: question.id, selectedOption: answer }
        : { questionId: question.id, response: answer };
    });
    setBusy(true);
    const response = await api.post<QuizResult>(`/api/v1/quizzes/${quiz.id}/submit`, {
      answers: submittedAnswers,
    });
    setBusy(false);
    if (!response.success) {
      toast.err(response.message);
      return;
    }
    setResult(response.data);
    toast.ok(response.message);
    onAttemptSaved?.();
  };

  return (
    <article className="rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <ClipboardList size={16} className="text-primary" />
            {quiz.title}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {quiz.questionCount} questions
            {quiz.attempts > 0 ? ` · ${quiz.attempts} attempt${quiz.attempts === 1 ? "" : "s"} · Best ${quiz.bestScore}%` : " · Not attempted"}
          </p>
        </div>
        {result && (
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{result.score}%</p>
            <p className="text-xs text-muted">{result.earnedPoints}/{result.possiblePoints} points</p>
          </div>
        )}
      </div>

      {result ? (
        <div className="mt-4 space-y-3">
          {result.results.map((item, index) => (
            <div key={item.questionId} className="rounded-lg border border-line bg-surface p-3">
              <p className="flex items-start gap-2 text-sm font-medium">
                {item.correct
                  ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-mint" />
                  : <XCircle size={16} className="mt-0.5 shrink-0 text-coral" />}
                <span>{index + 1}. {item.prompt}</span>
              </p>
              <p className="mt-2 text-xs text-muted">Your answer: {item.response}</p>
              {!item.correct && (
                <p className="mt-1 text-xs text-mint">
                  Accepted answer: {Array.isArray(item.expected) ? item.expected.join(" / ") : item.expected}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">{item.pointsAwarded}/{item.points} points</p>
            </div>
          ))}
          <button type="button" className="btn btn-ghost mt-1" onClick={() => { setAnswers({}); setResult(null); }}>
            <RotateCcw size={14} /> Try again
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-5">
          {quiz.questions.map((question, index) => (
            <fieldset key={question.id} className="space-y-2">
              <legend className="text-sm font-semibold">{index + 1}. {question.prompt} <span className="text-xs text-muted">({question.points} pt)</span></legend>
              {question.type === "multiple_choice" ? (
                question.options.map((option, optionIndex) => (
                  <label key={optionIndex} className="flex items-center gap-2 text-sm text-muted">
                    <input type="radio" name={`${quiz.id}-${question.id}`} value={optionIndex} required
                      checked={answers[question.id] === optionIndex}
                      onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} />
                    {option}
                  </label>
                ))
              ) : (
                <input className="input" type="text" maxLength={500} required
                  aria-label={`Answer for question ${index + 1}`}
                  value={String(answers[question.id] ?? "")}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
              )}
            </fieldset>
          ))}
          <button className="btn btn-primary" disabled={busy || !quiz.questions.length}>
            {busy ? "Submitting…" : "Submit quiz"}
          </button>
        </form>
      )}
    </article>
  );
}
