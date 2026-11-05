import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { WifiOff } from "lucide-react";
import Shell from "@/components/Shell";
import { SphereLoader } from "@/components/Logo";
import "./app/globals.css";

const Landing = lazy(() => import("@/app/page"));
const Admin = lazy(() => import("@/app/(app)/admin/page"));
const Assessment = lazy(() => import("@/app/(app)/assessment/page"));
const Assignments = lazy(() => import("@/app/(app)/assignments/page"));
const Badges = lazy(() => import("@/app/(app)/badges/page"));
const Billing = lazy(() => import("@/app/(app)/billing/page"));
const CourseDetail = lazy(() => import("@/app/(app)/courses/[id]/page"));
const Courses = lazy(() => import("@/app/(app)/courses/page"));
const Dashboard = lazy(() => import("@/app/(app)/dashboard/page"));
const Feedback = lazy(() => import("@/app/(app)/feedback/page"));
const Instructor = lazy(() => import("@/app/(app)/instructor/page"));
const InstructorAssignments = lazy(() => import("@/app/(app)/instructor/assignments/page"));
const InstructorCourses = lazy(() => import("@/app/(app)/instructor/courses/page"));
const Leaderboard = lazy(() => import("@/app/(app)/leaderboard/page"));
const Lesson = lazy(() => import("@/app/(app)/lessons/[id]/page"));
const Path = lazy(() => import("@/app/(app)/path/page"));
const Playground = lazy(() => import("@/app/(app)/playground/page"));
const Profile = lazy(() => import("@/app/(app)/profile/page"));
const Progress = lazy(() => import("@/app/(app)/progress/page"));
const Review = lazy(() => import("@/app/(app)/review/page"));
const Sessions = lazy(() => import("@/app/(app)/sessions/page"));
const Login = lazy(() => import("@/app/login/page"));
const Register = lazy(() => import("@/app/register/page"));
const VerifyClient = lazy(() => import("@/components/Verify"));
const VerifyEmail = lazy(() => import("@/app/verify-email/page"));

function AppLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      requestAnimationFrame(() => {
        document.querySelector(location.hash)?.scrollIntoView();
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.search, location.hash]);

  return null;
}

function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="card max-w-md p-6 text-center">
        <h1 className="display text-xl font-bold">Page not found</h1>
        <Link to="/" className="btn btn-primary mt-5">Back to home</Link>
      </div>
    </main>
  );
}

function VerifyRoute() {
  const { code } = useParams();
  return <VerifyClient initialCode={code ?? ""} />;
}

function OfflineNotice() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 border-b border-amber-400 bg-amber-300 px-4 py-2 text-center text-xs font-semibold text-slate-950 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <WifiOff size={15} aria-hidden="true" />
      <span>You're offline. The app shell is available, but live data and changes need a connection.</span>
    </div>
  );
}

function App() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}service-worker.js`,
    ).catch((error: unknown) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  return (
    <BrowserRouter>
      <OfflineNotice />
      <ScrollToTop />
      <Suspense fallback={<div className="min-h-screen grid place-items-center"><SphereLoader label="Loading EduSphere" /></div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<VerifyRoute />} />
          <Route path="/verify/:code" element={<VerifyRoute />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route element={<AppLayout />}>
            <Route path="/admin" element={<Admin />} />
            <Route path="/assessment" element={<Assessment />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/badges" element={<Badges />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/instructor" element={<Instructor />} />
            <Route path="/instructor/assignments" element={<InstructorAssignments />} />
            <Route path="/instructor/courses" element={<InstructorCourses />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/lessons/:id" element={<Lesson />} />
            <Route path="/path" element={<Path />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/review" element={<Review />} />
            <Route path="/sessions" element={<Sessions />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
