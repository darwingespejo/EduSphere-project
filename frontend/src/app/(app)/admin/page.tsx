"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, CircleDollarSign, Search, ShieldCheck, UserRoundCheck, UserRoundX,
} from "lucide-react";
import { ActivityArea } from "@/components/Charts";
import { SphereLoader } from "@/components/Logo";
import { PageHeader, SectionTitle, SkillBar, StatCard } from "@/components/ui";
import { toast } from "@/components/Toasts";
import { fmtDate, useApi } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/components/Shell";

type AdminUser = {
  id: string; name: string; email: string; role: string; active: boolean;
  xp: number; level: number; createdAt: string;
};
type AdminUsers = {
  rows: AdminUser[];
  counts: { role: string; count: number }[];
};
type AdminAnalytics = {
  users: {
    total: number; active: number; inactive: number; students: number; instructors: number; admins: number;
    verified: number; newUsers7d: number; newUsers28d: number; totalXp: number; averageXp: number;
    roles: { role: string; count: number }[];
  };
  activity: { date: string; signups: number; lessons: number; runs: number }[];
  learning: {
    enrollments: number; codeRuns: number; lessonsCompleted: number; peerReviewsSubmitted: number;
    peerReviewsPending: number; assignmentAttempts: number; assignmentAverageScore: number;
    lateAttempts: number; perfectAssignmentAttempts: number;
  };
  content: {
    courses: number; publishedCourses: number; lessons: number; exercises: number;
    assignments: number; publishedAssignments: number; certificates: number; badges: number;
  };
  revenue: {
    currencies: { currency: string; paidCents: number; paidTransactions: number; demoTransactions: number }[];
    activeSubscriptions: number;
    recent: { id: string; amountCents: number; currency: string; status: string; createdAt: string; userName: string; userEmail: string }[];
  };
  mastery: { skill: string; averageScore: number; learnerCount: number }[];
  topLearners: { id: string; name: string; email: string; xp: number; level: number; lessons: number; certificates: number; badges: number }[];
  popularCourses: { id: string; title: string; published: boolean; enrollments: number; lessons: number; certificates: number }[];
};

const number = (value: number) => value.toLocaleString();
const adminSections = ["overview", "activity", "learning", "mastery", "reviews", "courses", "payments", "users"];
const percent = (part: number, total: number) => total ? Math.round((part / total) * 100) : 0;
const money = (cents: number, currency: string) => new Intl.NumberFormat(undefined, {
  style: "currency", currency, maximumFractionDigits: 0,
}).format(cents / 100);

export default function AdminPage() {
  const { ready } = useRequireAuth("admin");
  const users = useApi<AdminUsers>(ready ? "/api/v1/admin/users" : null);
  const analytics = useApi<AdminAnalytics>(ready ? "/api/v1/admin/analytics" : null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const syncSection = () => {
      const section = window.location.hash.slice(1);
      setActiveSection(adminSections.includes(section) ? section : "overview");
    };
    syncSection();
    window.addEventListener("hashchange", syncSection);
    window.addEventListener("popstate", syncSection);
    return () => {
      window.removeEventListener("hashchange", syncSection);
      window.removeEventListener("popstate", syncSection);
    };
  }, []);

  const filteredUsers = useMemo(() => (users.data?.rows ?? []).filter((user) => {
    const matchesQuery = `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? user.active : !user.active);
    return matchesQuery && matchesRole && matchesStatus;
  }), [users.data?.rows, query, roleFilter, statusFilter]);

  if (!ready || users.loading || analytics.loading) return <SphereLoader label="Loading admin analytics" />;
  if (!users.data || !analytics.data) {
    return <p className="text-muted">{users.error ?? analytics.error ?? "Admin data is unavailable."}</p>;
  }

  const d = users.data;
  const a = analytics.data;
  const activationRate = percent(a.users.active, a.users.total);
  const verificationRate = percent(a.users.verified, a.users.total);
  const activityTotals = a.activity.reduce((totals, day) => ({
    signups: totals.signups + day.signups,
    lessons: totals.lessons + day.lessons,
    runs: totals.runs + day.runs,
  }), { signups: 0, lessons: 0, runs: 0 });
  const averageMastery = a.mastery.length
    ? Math.round(a.mastery.reduce((sum, skill) => sum + skill.averageScore, 0) / a.mastery.length)
    : 0;

  const toggle = async (id: string, active: boolean) => {
    setBusyId(id);
    const res = await api.patch("/api/v1/admin/users", { id, active: !active });
    setBusyId(null);
    if (!res.success) { toast.err(res.message); return; }
    toast.ok(res.message);
    void users.refetch();
    void analytics.refetch();
  };

  return (
    <div className="space-y-9">
      <PageHeader
        title="Admin console"
        sub="A detailed view of platform growth, learning activity, content, outcomes, and account health."
      />

      {activeSection === "overview" && <section id="overview">
        <SectionTitle title="Platform at a glance" sub="Current totals with recent growth and engagement." />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Registered users" value={number(a.users.total)} sub={`+${number(a.users.newUsers7d)} in the last 7 days`} accent="var(--primary)" />
          <StatCard label="Active accounts" value={`${activationRate}%`} sub={`${number(a.users.active)} active · ${number(a.users.inactive)} deactivated`} accent="var(--mint)" />
          <StatCard label="Course enrollments" value={number(a.learning.enrollments)} sub={`${number(a.content.publishedCourses)} published courses`} accent="var(--amber)" />
          <StatCard label="Active subscriptions" value={number(a.revenue.activeSubscriptions)} sub={`${number(a.revenue.currencies.reduce((sum, row) => sum + row.paidTransactions, 0))} paid transactions`} accent="var(--coral)" />
        </div>
      </section>}

      {activeSection === "activity" && <section id="activity" className="grid xl:grid-cols-[1.6fr_1fr] gap-4">
        <div className="card p-5 md:p-6">
          <SectionTitle title="Platform activity" sub="Daily registrations, lesson completions, and code runs over the last 28 days." />
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 text-xs text-muted font-mono">
            <span><i className="inline-block w-2 h-2 rounded-full bg-primary mr-2" />{number(activityTotals.signups)} signups</span>
            <span><i className="inline-block w-2 h-2 rounded-full bg-mint mr-2" />{number(activityTotals.lessons)} lessons</span>
            <span><i className="inline-block w-2 h-2 rounded-full bg-amber mr-2" />{number(activityTotals.runs)} code runs</span>
          </div>
          <ActivityArea data={a.activity} height={180} />
          <p className="text-[11px] text-muted mt-2">The chart tracks lessons completed and code runs; signups are summarized above.</p>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <SectionTitle title="Account health" sub="Role mix and verification." />
            <div className="space-y-4">
              {[
                { label: "Students", count: a.users.students, color: "var(--primary)" },
                { label: "Instructors", count: a.users.instructors, color: "var(--mint)" },
                { label: "Administrators", count: a.users.admins, color: "var(--amber)" },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>{row.label}</span><span className="font-mono text-muted">{number(row.count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-raised overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${percent(row.count, a.users.total)}%`, background: row.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-line">
              <div><p className="eyebrow">Verified email</p><p className="display text-2xl font-bold mt-1">{verificationRate}%</p><p className="text-xs text-muted">{number(a.users.verified)} accounts</p></div>
              <div><p className="eyebrow">New this month</p><p className="display text-2xl font-bold mt-1">{number(a.users.newUsers28d)}</p><p className="text-xs text-muted">last 28 days</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total XP awarded" value={number(a.users.totalXp)} sub={`${number(a.users.averageXp)} average per account`} />
            <StatCard label="Average mastery" value={`${averageMastery}%`} sub={`${a.mastery.length} measured skills`} accent="var(--mint)" />
          </div>
        </div>
      </section>}

      {activeSection === "learning" && <section id="learning">
        <SectionTitle title="Learning and content" sub="Inventory, participation, review workload, and assessment outcomes." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Lessons completed" value={number(a.learning.lessonsCompleted)} sub="Across all learner accounts" />
          <StatCard label="Code runs" value={number(a.learning.codeRuns)} sub="Last 28 days" accent="var(--mint)" />
          <StatCard label="Assignment attempts" value={number(a.learning.assignmentAttempts)} sub={`${number(a.learning.perfectAssignmentAttempts)} perfect-score attempts`} accent="var(--amber)" />
          <StatCard label="Average assignment score" value={`${a.learning.assignmentAverageScore}%`} sub={`${number(a.learning.lateAttempts)} late attempts`} accent="var(--coral)" />
          <StatCard label="Course catalog" value={number(a.content.courses)} sub={`${number(a.content.publishedCourses)} published`} />
          <StatCard label="Lessons and exercises" value={number(a.content.lessons + a.content.exercises)} sub={`${number(a.content.lessons)} lessons · ${number(a.content.exercises)} exercises`} accent="var(--mint)" />
          <StatCard label="Published assignments" value={`${number(a.content.publishedAssignments)} / ${number(a.content.assignments)}`} sub="Available to learners" accent="var(--amber)" />
          <StatCard label="Credentials issued" value={number(a.content.certificates)} sub={`${number(a.content.badges)} badge types`} accent="var(--coral)" />
        </div>
      </section>}

      {(activeSection === "mastery" || activeSection === "reviews") && <section className="grid gap-4">
        {activeSection === "mastery" && <div id="mastery" className="card p-5 md:p-6">
          <SectionTitle title="Skill mastery" sub="Average latest assessment score across learners." />
          {a.mastery.length ? (
            <div className="space-y-4">
              {a.mastery.map((skill) => (
                <div key={skill.skill}>
                  <SkillBar name={skill.skill} value={skill.averageScore} color={skill.averageScore < 40 ? "var(--coral)" : "var(--primary)"} />
                  <p className="text-[11px] text-muted mt-1">{number(skill.learnerCount)} learners measured</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted py-8 text-center">No placement measurements yet.</p>}
        </div>}
        {activeSection === "reviews" && <div id="reviews" className="card p-5 md:p-6">
          <SectionTitle title="Peer review operations" sub="Current queue volume and completed reviews." />
          <div className="grid grid-cols-2 gap-3">
            <div className="card-raise p-4"><p className="eyebrow">Waiting for review</p><p className="display text-3xl font-bold mt-2">{number(a.learning.peerReviewsPending)}</p><p className="text-xs text-muted mt-1">pending assignments</p></div>
            <div className="card-raise p-4"><p className="eyebrow">Reviews submitted</p><p className="display text-3xl font-bold mt-2">{number(a.learning.peerReviewsSubmitted)}</p><p className="text-xs text-muted mt-1">completed assignments</p></div>
          </div>
          <div className="mt-5 rounded-xl border border-line p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Activity size={15} className="text-mint" /> Queue completion</div>
            <div className="h-2 rounded-full bg-raised overflow-hidden mt-3">
              <div className="h-full bg-mint rounded-full" style={{ width: `${percent(a.learning.peerReviewsSubmitted, a.learning.peerReviewsSubmitted + a.learning.peerReviewsPending)}%` }} />
            </div>
            <p className="text-xs text-muted mt-2">{percent(a.learning.peerReviewsSubmitted, a.learning.peerReviewsSubmitted + a.learning.peerReviewsPending)}% of assigned reviews are complete.</p>
          </div>
        </div>}
      </section>}

      {activeSection === "courses" && <section id="courses" className="grid xl:grid-cols-2 gap-4">
        <div className="card p-5 md:p-6">
          <SectionTitle title="Most enrolled courses" sub="Enrollment and course completion signals." />
          <div className="space-y-3">
            {a.popularCourses.length ? a.popularCourses.map((course, index) => (
              <div key={course.id} className="card-raise p-4 flex items-center gap-4">
                <span className="w-9 h-9 rounded-xl bg-surface grid place-items-center font-mono text-sm text-primary">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{course.title}</p>
                  <p className="text-xs text-muted mt-1">{number(course.lessons)} lessons · {number(course.certificates)} certificates · {course.published ? "published" : "draft"}</p>
                </div>
                <div className="text-right shrink-0"><p className="font-mono font-semibold">{number(course.enrollments)}</p><p className="text-[10px] text-muted">enrolled</p></div>
              </div>
            )) : <p className="text-sm text-muted py-8 text-center">No courses have been created yet.</p>}
          </div>
        </div>
        <div className="card p-5 md:p-6">
          <SectionTitle title="Top learners" sub="Active student accounts ranked by earned XP." />
          <div className="space-y-2">
            {a.topLearners.length ? a.topLearners.map((learner, index) => (
              <div key={learner.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-raised/60 transition-colors">
                <span className="font-mono text-xs text-muted w-6">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{learner.name}</p>
                  <p className="text-xs text-muted truncate">{learner.email}</p>
                </div>
                <div className="text-right"><p className="font-mono text-sm font-semibold">{number(learner.xp)} XP</p><p className="text-[10px] text-muted">level {learner.level} · {learner.lessons} lessons</p></div>
              </div>
            )) : <p className="text-sm text-muted py-8 text-center">No active student accounts yet.</p>}
          </div>
        </div>
      </section>}

      {activeSection === "payments" && <section className="grid gap-4">
        <div id="payments" className="card p-5 md:p-6">
          <SectionTitle title="Payments overview" sub="Paid amounts are grouped by currency." />
          <div className="space-y-3">
            {a.revenue.currencies.length ? a.revenue.currencies.map((currency) => (
              <div key={currency.currency} className="card-raise p-4 flex justify-between items-center gap-4">
                <div><p className="eyebrow">{currency.currency} captured</p><p className="display text-2xl font-bold mt-1">{money(currency.paidCents, currency.currency)}</p></div>
                <div className="text-right text-xs text-muted"><p>{number(currency.paidTransactions)} paid</p><p>{number(currency.demoTransactions)} demo</p></div>
              </div>
            )) : <p className="text-sm text-muted py-5 text-center">No payment records yet.</p>}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted"><CircleDollarSign size={14} className="text-mint" /> Paid totals and plan access come from verified PayMongo webhooks.</div>
          {a.revenue.recent.length > 0 && (
            <div className="mt-5 border-t border-line pt-4 space-y-3">
              <p className="eyebrow">Recent payment activity</p>
              {a.revenue.recent.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0"><p className="truncate font-medium">{payment.userName}</p><p className="text-muted truncate">{payment.userEmail}</p></div>
                  <div className="text-right shrink-0"><p>{money(payment.amountCents, payment.currency.toUpperCase())}</p><p className="text-muted">{payment.status} · {fmtDate(payment.createdAt)}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>}
      {activeSection === "users" && <section>
        <div id="users" className="card p-5 md:p-6">
          <SectionTitle title="All user accounts" sub={`${number(d.rows.filter((row) => row.active).length)} active of ${number(d.rows.length)} total`} />
          <div className="grid sm:grid-cols-[1fr_150px_150px] gap-2 mb-4">
            <label className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input !pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" aria-label="Search users" />
            </label>
            <select className="input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
              <option value="all">All roles</option><option value="student">Students</option><option value="instructor">Instructors</option><option value="admin">Admins</option>
            </select>
            <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Deactivated</option>
            </select>
          </div>
          <p className="text-xs text-muted mb-3">Showing {number(filteredUsers.length)} of {number(d.rows.length)} accounts</p>
          <div className="card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[690px]">
              <thead>
                <tr className="text-left text-muted text-[11px] font-mono border-b border-line">
                  <th className="px-4 py-3 font-normal">Account</th><th className="px-3 py-3 font-normal">Role</th>
                  <th className="px-3 py-3 font-normal">XP / level</th><th className="px-3 py-3 font-normal">Joined</th>
                  <th className="px-3 py-3 font-normal">Status</th><th className="px-4 py-3 font-normal">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(index * 0.015, 0.25) }}
                    className={`border-b border-line/50 last:border-0 ${!user.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 min-w-56"><p className="font-medium">{user.name}</p><p className="font-mono text-[11px] text-muted">{user.email}</p></td>
                    <td className="px-3 py-3"><span className="tag">{user.role}</span></td>
                    <td className="px-3 py-3 font-mono text-xs">{number(user.xp)} / {user.level}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted">{fmtDate(user.createdAt)}</td>
                    <td className="px-3 py-3">
                      {user.active
                        ? <span className="flex items-center gap-1.5 text-mint text-xs"><UserRoundCheck size={13} /> active</span>
                        : <span className="flex items-center gap-1.5 text-coral text-xs"><UserRoundX size={13} /> inactive</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button disabled={busyId === user.id || user.role === "admin"}
                        onClick={() => toggle(user.id, user.active)}
                        className={`btn !py-1 !px-3 text-[12px] ${user.active ? "btn-ghost !text-coral" : "btn-ghost !text-mint"}`}>
                        {busyId === user.id ? "…" : user.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </motion.tr>
                ))}
                {filteredUsers.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">No accounts match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>}

      {activeSection === "overview" && <div className="card p-5 flex items-start gap-3">
        <ShieldCheck size={16} className="text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-muted leading-relaxed">
          Admin analytics are aggregated from platform activity and database records. Payment amounts are grouped by currency; demo payments are shown separately from captured payments. Use the account filters to find users and manage access.
        </p>
      </div>}
    </div>
  );
}
