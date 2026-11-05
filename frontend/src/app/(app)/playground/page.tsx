"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "@/router/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Eye, Lock, Play, RotateCcw, Send, SquareTerminal, X } from "lucide-react";
import { SphereLoader } from "@/components/Logo";
import { PageHeader, SectionTitle } from "@/components/ui";
import { BadgeModal, type EarnedBadge } from "@/components/BadgeModal";
import { toast } from "@/components/Toasts";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";

const Monaco = dynamic(() => import("@monaco-editor/react"), { loading: () => <div className="skeleton h-[420px]" /> });
const LANGUAGE_LABELS: Record<string, string> = {
  html: "HTML / CSS / JS",
  javascript: "JavaScript",
  python: "Python",
  c: "C",
  cpp: "C++",
  csharp: "C#",
};

const FREE_RUN_TEMPLATES: Record<string, string> = {
  javascript: 'console.log("Hello, world!");\n',
  python: 'import json\nimport sys\n\nvalues = json.loads(sys.stdin.read() or "[]")\nprint(sum(values))\n',
  c: '#include <stdio.h>\n\nint main(void) {\n    int value;\n    long sum = 0;\n    while (scanf("%d", &value) == 1) sum += value;\n    printf("%ld\\n", sum);\n    return 0;\n}\n',
  cpp: '#include <iostream>\n\nint main() {\n    long long value, sum = 0;\n    while (std::cin >> value) sum += value;\n    std::cout << sum << "\\n";\n}\n',
  csharp: 'using System;\nusing System.Linq;\n\nclass Program {\n    static void Main() {\n        var input = Console.In.ReadToEnd();\n        var sum = input.Split((char[])null, StringSplitOptions.RemoveEmptyEntries)\n            .Sum(value => long.Parse(value));\n        Console.WriteLine(sum);\n    }\n}\n',
};

type Exercise = {
  id: string; title: string; prompt: string; language: string; starterCode: string;
  course: string; skill: string | null; visibleTests: number; totalTests: number; bestPassed: number | null;
  runnerAvailable: boolean; serverRunnerAvailable: boolean; visibleTestCases: VisibleTestCase[];
};
type VisibleTestCase = { input: string; expected: string };
type CaseResult = { input: string; expected: string; actual: string; passed: boolean; log: string[]; hidden: boolean };
type Assignment = { id: string; exerciseId: string; title: string; instructions: string; dueAt: string | null };
type RunResp = {
  stdout: string; stderr: string; runtimeMs: number; passedCount: number; totalCount: number;
  results: CaseResult[]; xpGained: number; badges: (EarnedBadge | null)[];
  assignmentAttempt: { id: string; score: number; isLate: boolean; certificateCode: string | null } | null;
  localOnly: boolean;
};

const LOCAL_RUNNER_DOCUMENT = `<!doctype html><meta charset="utf-8"><script>
window.addEventListener("message", async function(event) {
  const data = event.data;
  if (!data || data.type !== "edusphere-local-run") return;
  const started = performance.now();
  const logs = [];
  const print = function() {
    const args = Array.from(arguments);
    logs.push(args.map(function(value) {
      if (typeof value === "string") return value;
      try { return JSON.stringify(value); } catch { return String(value); }
    }).join(" "));
  };
  const safeConsole = { log: print, info: print, warn: print, error: print };
  const stringify = function(value) {
    if (typeof value === "undefined") return "undefined";
    try { return JSON.stringify(value); } catch { return String(value); }
  };
  const canonical = function(value) {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map(function(key) {
        return JSON.stringify(key) + ":" + canonical(value[key]);
      }).join(",") + "}";
    }
    return JSON.stringify(value);
  };
  try {
    const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
    if (data.mode === "free") {
      const execute = new AsyncFunction("stdin", "console", data.code);
      await execute(data.stdin, safeConsole);
      parent.postMessage({
        type: "edusphere-local-result",
        id: data.id,
        result: { stdout: logs.join("\\n"), stderr: "", runtimeMs: Math.round(performance.now() - started), passedCount: 0, totalCount: 0, results: [], xpGained: 0, badges: [], assignmentAttempt: null, localOnly: true }
      }, "*");
      return;
    }
    const results = [];
    for (const test of data.tests) {
      logs.length = 0;
      try {
        const input = JSON.parse(test.input);
        const expected = JSON.parse(test.expected);
        const execute = new AsyncFunction("input", "console",
          data.code + "\\n; if (typeof solve !== 'function') throw new Error('Define solve(input) to run tests.'); return await solve(input);"
        );
        const actualValue = await execute(input, safeConsole);
        const actual = stringify(actualValue);
        results.push({
          input: test.input,
          expected: test.expected,
          actual: actual,
          passed: canonical(actualValue) === canonical(expected),
          log: logs.slice(),
          hidden: false
        });
      } catch (error) {
        results.push({
          input: test.input,
          expected: test.expected,
          actual: "Error: " + (error && error.message ? error.message : String(error)),
          passed: false,
          log: logs.slice(),
          hidden: false
        });
      }
    }
    const passedCount = results.filter(function(result) { return result.passed; }).length;
    parent.postMessage({
      type: "edusphere-local-result",
      id: data.id,
      result: { stdout: "", stderr: "", runtimeMs: Math.round(performance.now() - started), passedCount: passedCount, totalCount: results.length, results: results, xpGained: 0, badges: [], assignmentAttempt: null, localOnly: true }
    }, "*");
  } catch (error) {
    parent.postMessage({
      type: "edusphere-local-result",
      id: data.id,
      error: error && error.message ? error.message : String(error)
    }, "*");
  }
});
</script>`;

function runJavaScriptLocally(
  code: string,
  mode: "free" | "exercise",
  tests: VisibleTestCase[],
  stdin: string,
): Promise<RunResp> {
  if (code.length > 50_000) return Promise.reject(new Error("Code exceeds the 50,000 character limit."));

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.title = "Isolated JavaScript runner";
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.hidden = true;
    const id = crypto.randomUUID();
    let settled = false;
    let timeout = 0;

    const finish = (error?: Error, result?: RunResp) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      iframe.remove();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error("The local code runner returned no result."));
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || event.data?.type !== "edusphere-local-result" || event.data.id !== id) return;
      if (event.data.error) {
        finish(new Error(String(event.data.error)));
        return;
      }
      finish(undefined, normalizeRunResponse(event.data.result));
    };

    window.addEventListener("message", onMessage);
    timeout = window.setTimeout(() => finish(new Error("Code execution timed out after 5 seconds.")), 5000);
    iframe.addEventListener("load", () => {
      iframe.contentWindow?.postMessage({ type: "edusphere-local-run", id, mode, code, tests, stdin }, "*");
    }, { once: true });
    iframe.srcdoc = LOCAL_RUNNER_DOCUMENT;
    document.body.appendChild(iframe);
  });
}

function normalizeRunResponse(value: Partial<RunResp> | null): RunResp {
  const results = Array.isArray(value?.results) ? value.results : [];
  return {
    stdout: typeof value?.stdout === "string" ? value.stdout : "",
    stderr: typeof value?.stderr === "string" ? value.stderr : "",
    runtimeMs: Number(value?.runtimeMs) || 0,
    passedCount: Number(value?.passedCount) || 0,
    totalCount: Number(value?.totalCount) || 0,
    results: results.map((result) => ({
      ...result,
      input: String(result?.input ?? ""),
      expected: String(result?.expected ?? ""),
      actual: String(result?.actual ?? ""),
      passed: Boolean(result?.passed),
      log: Array.isArray(result?.log) ? result.log.map(String) : [],
      hidden: Boolean(result?.hidden),
    })),
    xpGained: Number(value?.xpGained) || 0,
    badges: Array.isArray(value?.badges) ? value.badges : [],
    assignmentAttempt: value?.assignmentAttempt ?? null,
    localOnly: Boolean(value?.localOnly),
  };
}

function getSavedCode(userId: string | undefined, exercise: Exercise): string {
  if (!userId) return exercise.starterCode;
  return window.localStorage.getItem(`edusphere-playground:${userId}:${exercise.id}`) ?? exercise.starterCode;
}

function getSavedFreeCode(userId: string | undefined, language: string): string {
  const template = FREE_RUN_TEMPLATES[language] ?? "";
  if (!userId) return template;
  return window.localStorage.getItem(`edusphere-playground:${userId}:free:${language}`) ?? template;
}

export default function PlaygroundPage() {
  const { user, setUser } = useAuth();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [freeRun, setFreeRun] = useState(false);
  const [code, setCode] = useState("");
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunResp | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [rightTab, setRightTab] = useState<"console" | "preview">("console");
  const [consoleLines, setConsoleLines] = useState<string[]>([]);

  const active = exercises?.find((e) => e.id === activeId) ?? null;
  const isHtml = active?.language === "html";
  const isCompiledLanguage = !!active && ["c", "cpp", "csharp"].includes(active.language);
  const availableLanguages = [...new Set((exercises ?? []).map((exercise) => exercise.language))];
  const languageExercises = (exercises ?? []).filter((exercise) =>
    assignment ? exercise.id === assignment.exerciseId : exercise.language === active?.language);

  useEffect(() => {
    (async () => {
      const assignmentId = new URLSearchParams(window.location.search).get("assignment");
      const [res, assignmentRes] = await Promise.all([
        api.get<Exercise[]>("/api/v1/exercises"),
        assignmentId && user?.role === "student"
          ? api.get<Assignment>(`/api/v1/coding-assignments/${assignmentId}`)
          : Promise.resolve(null),
      ]);
      if (res.success && Array.isArray(res.data) && res.data.length) {
        if (assignmentRes && !assignmentRes.success) toast.err(assignmentRes.message);
        const requestedAssignment = assignmentRes?.success ? assignmentRes.data : null;
        const selected = res.data.find((exercise) => exercise.id === requestedAssignment?.exerciseId) ?? res.data[0];
        setExercises(res.data);
        setActiveId(selected.id);
        setCode(getSavedCode(user?.id, selected));
        setAssignment(requestedAssignment);
      } else setExercises([]);
    })();
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user?.id || !code) return;
    const draftKey = freeRun
      ? `edusphere-playground:${user.id}:free:${active?.language ?? "javascript"}`
      : activeId ? `edusphere-playground:${user.id}:${activeId}` : null;
    if (draftKey) window.localStorage.setItem(draftKey, code);
  }, [active?.language, activeId, code, freeRun, user?.id]);

  const selectExercise = (exercise: Exercise) => {
    setActiveId(exercise.id);
    setCode(freeRun ? getSavedFreeCode(user?.id, exercise.language) : getSavedCode(user?.id, exercise));
    setRun(null);
    setConsoleLines([]);
    setRightTab(exercise.language === "html" ? "preview" : "console");
  };

  const pick = (id: string) => {
    if (assignment || freeRun) return;
    const ex = exercises?.find((e) => e.id === id);
    if (!ex) return;
    selectExercise(ex);
  };

  const runCode = async (submitAssignment = false) => {
    if (!active || running || isHtml) return;
    if (submitAssignment && !active.serverRunnerAvailable) {
      toast.info("Submission requires a configured Judge0 server. You can still practice locally.");
      return;
    }
    setRunning(true);
    setRun(null);
    const started = Date.now();
    const minWait = 650; // let the running state register — real runtime comes back in the payload
    let result: RunResp;
    if (active.language === "javascript" && !submitAssignment) {
      try {
        result = await runJavaScriptLocally(
          code,
          freeRun ? "free" : "exercise",
          freeRun ? [] : active.visibleTestCases,
          stdin,
        );
      } catch (error) {
        setRunning(false);
        toast.err(error instanceof Error ? error.message : "Local code execution failed.");
        return;
      }
    } else {
      const res = await api.post<RunResp>("/api/v1/playground/run", {
        ...(!freeRun ? { exerciseId: active.id } : {}),
        code,
        language: active.language,
        ...(freeRun ? { input: stdin } : {}),
        ...(submitAssignment && assignment && !freeRun ? { assignmentId: assignment.id, submit: true } : {}),
      });
      if (!res.success) {
        setRunning(false);
        toast.err(res.message);
        return;
      }
      result = normalizeRunResponse(res.data);
    }
    const dwell = Math.max(0, minWait - (Date.now() - started));
    if (dwell) await new Promise((r) => setTimeout(r, dwell));
    setRunning(false);
    setRun(result);
    setRightTab("console");
    if (result.localOnly) return;
    if (result.assignmentAttempt) {
      const attempt = result.assignmentAttempt;
      toast.ok(`Assignment submitted · ${attempt.score}%${attempt.isLate ? " · late" : ""}${attempt.certificateCode ? ` · certificate ${attempt.certificateCode}` : ""}`);
    }
    const earned = result.badges.filter(Boolean) as EarnedBadge[];
    if (earned.length) setBadges(earned);
    if (result.xpGained > 0) toast.ok(`+${result.xpGained} XP`);
    if (!freeRun) {
      const me = await api.get<{ user: Parameters<typeof setUser>[0] }>("/api/v1/auth/me");
      if (me.success) setUser(me.data.user);
    }
  };

  const toggleFreeRun = (enabled: boolean) => {
    if (assignment || !active) return;
    const selected = enabled && active.language === "html"
      ? exercises?.find((exercise) => exercise.language !== "html") ?? active
      : active;
    setActiveId(selected.id);
    setFreeRun(enabled);
    setRun(null);
    setCode(enabled ? getSavedFreeCode(user?.id, selected.language) : getSavedCode(user?.id, selected));
  };

  const submitForReview = async () => {
    if (!active) return;
    const res = await api.post<{ assigned: number }>("/api/v1/submissions", {
      exerciseId: active.id, code, language: active.language,
    });
    if (!res.success) { toast.err(res.message); return; }
    toast.ok(res.message);
  };

  const previewDoc = isHtml
    ? `${code}\n<script>
      (function(){ const send = (k, a) => parent.postMessage({ edu: 1, k, t: a.map(String).join(" ") }, "*");
        ["log","warn","error"].forEach((k) => { const orig = console[k].bind(console); console[k] = (...a) => { send(k, a); orig(...a); }; });
        window.addEventListener("error", (e) => send("error", [e.message]));
      })();
    </script>`
    : "";

  return (
    <div>
      {badges.length > 0 && <BadgeModal badges={badges} onClose={() => setBadges(badges.slice(1))} />}
      <PageHeader title="Playground" sub="Run code in free practice without an assignment, or work through the course exercises. JavaScript runs locally; Python, C, C++, and C# use the configured Judge0 runner." />

      {assignment && (
        <div className="card p-5 mb-4 border-primary/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Assignment</p>
              <h2 className="display font-bold text-lg mt-1">{assignment.title}</h2>
            </div>
            {assignment.dueAt && <span className="tag">Due {new Date(assignment.dueAt).toLocaleString()}</span>}
          </div>
          {assignment.instructions && <p className="text-muted text-sm mt-3 whitespace-pre-wrap">{assignment.instructions}</p>}
        </div>
      )}

      {!exercises ? <SphereLoader label="Loading exercises" /> : exercises.length === 0 ? (
        <p className="text-muted">No exercises seeded.</p>
      ) : (
        <div className="grid lg:grid-cols-[240px_1fr] gap-4 items-start">
          {/* exercise list */}
          <div className="card p-3 space-y-1.5 lg:sticky lg:top-24">
            {!assignment && (
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-raised p-1 mb-2">
                <button onClick={() => toggleFreeRun(false)} className={`rounded-lg px-2 py-1.5 text-xs ${!freeRun ? "bg-primary text-white" : "text-muted hover:text-text"}`}>Exercises</button>
                <button onClick={() => toggleFreeRun(true)} className={`rounded-lg px-2 py-1.5 text-xs ${freeRun ? "bg-primary text-white" : "text-muted hover:text-text"}`}>Free run</button>
              </div>
            )}
            {!assignment && availableLanguages.length > 1 && (
              <label className="block px-2 pb-2 text-xs text-muted">
                Language
                <select className="input mt-1.5" value={active?.language ?? ""} onChange={(event) => {
                  const next = exercises.find((exercise) => exercise.language === event.target.value);
                  if (next) selectExercise(next);
                }}>
                  {availableLanguages.filter((language) => !freeRun || language !== "html").map((language) => (
                    <option key={language} value={language}>{LANGUAGE_LABELS[language] ?? language}</option>
                  ))}
                </select>
              </label>
            )}
            {!freeRun && <p className="eyebrow px-2 pb-1.5">Exercises</p>}
            {!freeRun && languageExercises.map((ex) => {
              const on = ex.id === activeId;
              const passedAll = ex.language !== "javascript" && ex.bestPassed !== null && ex.bestPassed === ex.totalTests;
              return (
                <button key={ex.id} onClick={() => pick(ex.id)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${on ? "bg-primary/12 border border-primary/30" : "hover:bg-raised border border-transparent"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[13px] font-medium truncate ${on ? "text-primary" : ""}`}>{ex.title}</p>
                    {passedAll && <Check size={13} className="text-mint shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted font-mono mt-0.5">{LANGUAGE_LABELS[ex.language] ?? ex.language} · {ex.language === "javascript" ? `${ex.visibleTests} visible tests` : `${ex.totalTests} tests`}</p>
                </button>
              );
            })}
          </div>

          {active && (
            <div className="space-y-4 min-w-0">
              {!freeRun && <div className="card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="display font-bold text-lg">{active.title}</h2>
                  {active.skill && <span className="tag">{active.skill}</span>}
                  <span className="tag">{active.course}</span>
                </div>
                <p className="text-muted text-sm leading-relaxed mt-2.5">{active.prompt}</p>
              </div>}

              <div className="grid xl:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <SectionTitle title={freeRun ? `${LANGUAGE_LABELS[active.language] ?? active.language} free practice` : isHtml ? "Markup, styles and script" : "Your solution"} sub={freeRun || isHtml || isCompiledLanguage ? undefined : "must define solve(input)"}
                    right={<span className="tag font-mono">{code.length.toLocaleString()} chars</span>} />
                  <div className="monaco-wrap">
                    <Monaco
                      height="420px"
                      language={isHtml ? "html" : active.language}
                      value={code}
                      onChange={(v) => setCode(v ?? "")}
                      theme="edu-dark"
                      options={{ fontSize: 13.5, minimap: { enabled: false }, fontFamily: "var(--font-jetbrains)", padding: { top: 14 }, scrollBeyondLastLine: false, tabSize: 2 }}
                      beforeMount={(monaco) => {
                        monaco.editor.defineTheme("edu-dark", {
                          base: "vs-dark", inherit: true,
                          rules: [{ token: "comment", foreground: "7a7fa8" }],
                          colors: {
                            "editor.background": "#0d1024", "editor.lineHighlightBackground": "#151a3633",
                            "editorLineNumber.foreground": "#3d4270", "editorCursor.foreground": "#3ef0c0",
                          },
                        });
                      }}
                    />
                  </div>
                  {freeRun && !isHtml && (
                    <label className="mt-3 block text-xs text-muted">
                      Standard input
                      <textarea
                        className="input mt-1.5 min-h-20 font-mono text-xs"
                        value={stdin}
                        onChange={(event) => {
                          setStdin(event.target.value);
                          if (user?.id) window.localStorage.setItem(`edusphere-playground:${user.id}:stdin`, event.target.value);
                        }}
                        placeholder={active.language === "python" ? "[1, 2, 3]" : "1 2 3"}
                        aria-label="Standard input"
                      />
                    </label>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex gap-1 card-raise p-1 rounded-xl">
                      <button onClick={() => setRightTab("console")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${rightTab === "console" ? "bg-primary text-white" : "text-muted hover:text-text"}`}>
                        <SquareTerminal size={13} /> Console
                      </button>
                      <button onClick={() => { setRightTab("preview"); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${rightTab === "preview" ? "bg-primary text-white" : "text-muted hover:text-text"}`}>
                        <Eye size={13} /> Preview
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {!isHtml && (
                        <button
                          onClick={() => {
                            setCode(freeRun ? (FREE_RUN_TEMPLATES[active.language] ?? "") : active.starterCode);
                            window.localStorage.removeItem(freeRun
                              ? `edusphere-playground:${user?.id}:free:${active.language}`
                              : `edusphere-playground:${user?.id ?? "anonymous"}:${active.id}`);
                          }}
                          className="btn btn-ghost !py-2"
                          title="Restore the original starter code"
                        >
                          <RotateCcw size={13} /> Reset
                        </button>
                      )}
                      {!isHtml && (
                        <button onClick={() => void runCode()} disabled={running || !active.runnerAvailable} className="btn btn-primary !py-2 min-w-[96px]">
                          {running ? <><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" /><span className="relative inline-flex rounded-full h-3 w-3 bg-white" /></span> Running</> : <><Play size={14} /> Run code</>}
                        </button>
                      )}
                      {assignment && !isHtml && (
                        <button onClick={() => void runCode(true)} disabled={running || !active.serverRunnerAvailable} className="btn btn-mint !py-2">
                          <Send size={13} /> Submit assignment
                        </button>
                      )}
                      {isHtml && (
                        <button onClick={submitForReview} className="btn btn-mint !py-2"><Send size={13} /> Submit for review</button>
                      )}
                    </div>
                  </div>

                  {rightTab === "console" ? (
                    <div className="monaco-wrap bg-[#0d1024] min-h-[420px] p-4 overflow-y-auto max-h-[520px]">
                      {active.language === "javascript" && !freeRun && (
                        <p className="mb-3 rounded-lg border border-mint/30 bg-mint/5 p-3 text-sm text-mint">
                          Runs in an isolated browser frame using visible tests only. Local results are for practice and do not award XP or count toward a score.
                        </p>
                      )}
                      {!isHtml && !active.runnerAvailable && (
                        <p className="mb-3 rounded-lg border border-amber/40 bg-amber/5 p-3 text-sm text-amber">
                          Practice mode is available and your code is saved in this browser. Running {freeRun ? "code" : `tests for ${LANGUAGE_LABELS[active.language] ?? active.language}`} requires a Judge0 instance configured with <code>JUDGE0_URL</code>.
                        </p>
                      )}
                      {!isHtml && active.language !== "javascript" && active.runnerAvailable && (
                        <p className="mb-3 rounded-lg border border-amber/40 bg-amber/5 p-3 text-sm text-amber">
                          Code and input are sent to the configured Judge0 service. Avoid passwords, API keys, or other sensitive data.
                        </p>
                      )}
                      {active.language === "javascript" && freeRun && (
                        <p className="mb-3 rounded-lg border border-mint/30 bg-mint/5 p-3 text-sm text-mint">
                          JavaScript runs locally in an isolated browser frame. Use <code>console.log(...)</code> for output; no runner account is needed.
                        </p>
                      )}
                      {!run && !running && (
                        <div className="text-[#7a7fa8] font-mono text-[12.5px] space-y-1.5 py-2">
                          <p>{freeRun ? "// press Run to execute this program with the standard input above" : isHtml ? "// HTML mode — use the Preview tab and Submit for review." : isCompiledLanguage ? "// read the test input from standard input and print one result line" : "// press Run to execute your solve() against the test cases"}</p>
                          {active.language !== "javascript" && active.bestPassed !== null && <p>{`// personal best here: ${active.bestPassed}/${active.totalTests} passed`}</p>}
                        </div>
                      )}
                      {running && (
                        <div className="space-y-2.5 py-1">
                          {[...Array(Math.max(1, active.totalTests))].map((_, i) => (
                            <div key={i} className="skeleton h-8 !bg-[#141a38]" style={{ animationDelay: `${i * 120}ms` }} />
                          ))}
                        </div>
                      )}
                      {run && (
                        <div className="space-y-2.5">
                          {freeRun && (
                            <div className="rounded-xl border border-line bg-[#0d1024] p-3">
                              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[#8b8fc0]">Program output</p>
                              <pre className="font-mono text-[12px] text-[#c9d1ff] whitespace-pre-wrap break-words">{run.stdout || (run.stderr ? "No standard output." : "(no output)")}</pre>
                              <p className="mt-2 font-mono text-[11px] text-[#8b8fc0]">{run.runtimeMs} ms</p>
                            </div>
                          )}
                          {run.stderr && (
                            <p className="font-mono text-[12px] text-[#ff8f9a] leading-relaxed whitespace-pre-wrap">{run.stderr}</p>
                          )}
                          <AnimatePresence>
                            {!freeRun && run.results.map((r, i) => (
                              <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: i * 0.14, duration: 0.3 }}
                                className={`rounded-xl border p-3 font-mono text-[12px] leading-relaxed ${r.passed ? "border-[#2d8f6b]/50 bg-[#123528]/40" : "border-[#8f2d3a]/50 bg-[#35121a]/40"}`}>
                                <div className="flex items-center gap-2">
                                  {r.passed ? <Check size={13} className="text-[#3ef0c0]" /> : <X size={13} className="text-[#ff8f9a]" />}
                                  <span className="text-[#c9d1ff] truncate">{r.hidden ? "Hidden test" : `solve(${r.input.length > 60 ? r.input.slice(0, 60) + "…" : r.input})`}</span>
                                  {r.hidden && <span className="ml-auto flex items-center gap-1 text-[#8b8fc0]"><Lock size={10} /> hidden</span>}
                                </div>
                                {!r.passed && !r.hidden && (
                                  <div className="mt-1.5 space-y-0.5 text-[#8b8fc0]">
                                    <p>expected: <span className="text-[#3ef0c0] break-all">{r.expected}</span></p>
                                    <p>got: <span className="text-[#ff8f9a] break-all">{r.actual}</span></p>
                                  </div>
                                )}
                                {r.log.length > 0 && <p className="mt-1.5 text-[#8b8fc0]">console: {r.log.join(" · ")}</p>}
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          {!freeRun && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: run.results.length * 0.14 + 0.15 }}
                            className="font-mono text-[12px] text-[#8b8fc0] pt-1">
                            {run.passedCount}/{run.totalCount} {run.localOnly ? "visible tests passed · local only" : "passed"} · {run.runtimeMs} ms{run.xpGained > 0 ? ` · +${run.xpGained} XP` : ""}
                          </motion.p>}
                          {run.assignmentAttempt && (
                            <p className="rounded-lg bg-[#151a36] px-3 py-2 font-mono text-xs text-[#c9d1ff]">
                              Recorded attempt · {run.assignmentAttempt.score}%{run.assignmentAttempt.isLate ? " · submitted late" : ""}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <PreviewPane key={activeId ?? "none"} doc={previewDoc} isHtml={isHtml} onLines={setConsoleLines} lines={consoleLines} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewPane({ doc, isHtml, lines, onLines }: { doc: string; isHtml: boolean; lines: string[]; onLines: (l: string[]) => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { edu?: number; k?: string; t?: string };
      if (data?.edu && data.t) onLines([...lines.slice(-80), `${data.k}: ${data.t}`]);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [lines, onLines]);

  if (!isHtml) {
    return (
      <div className="monaco-wrap bg-[#0d1024] min-h-[420px] p-4">
        <pre className="font-mono text-[12px] text-[#8b8fc0] whitespace-pre-wrap">{lines.length ? lines.join("\n") : "// browser console output from your script appears here"}</pre>
      </div>
    );
  }
  return (
    <div className="monaco-wrap min-h-[420px] bg-white">
      {/* sandboxed: scripts run but can't touch the page above */}
      <iframe ref={iframeRef} title="Live preview" sandbox="allow-scripts" srcDoc={doc} className="w-full h-[420px]" />
    </div>
  );
}
