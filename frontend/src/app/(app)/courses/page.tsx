"use client";
import Link from "@/router/link";
import { BookOpen, CheckCircle2, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { SphereLoader } from "@/components/Logo";
import { useRequireAuth } from "@/components/Shell";
import { useApi } from "@/lib/hooks";

type CourseCard = {
  id: string; title: string; description: string; level: string; instructor: string;
  enrolled: boolean; lessonCount: number; completedLessons: number;
};

export default function CoursesPage() {
  const { ready } = useRequireAuth();
  const data = useApi<CourseCard[]>(ready ? "/api/v1/courses" : null);
  if (!ready || data.loading) return <SphereLoader label="Loading courses" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Course catalog" sub="Follow instructor-led modules, download resources, complete coding assignments, and earn verified certificates." />
      {data.error && <div className="card p-4 text-coral text-sm">{data.error}</div>}
      {!data.data?.length ? (
        <div className="card p-8 text-center">
          <BookOpen size={28} className="mx-auto text-muted" />
          <p className="font-semibold mt-3">No published courses yet</p>
          <p className="text-sm text-muted mt-1">Check back when an instructor publishes a course.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.data.map((course) => (
            <article key={course.id} className="card p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="tag">{course.level}</span>
                {course.enrolled && <span className="tag !text-mint !border-mint/40"><CheckCircle2 size={11} /> Enrolled</span>}
              </div>
              <h2 className="display text-xl font-bold mt-4">{course.title}</h2>
              <p className="text-sm text-muted mt-2 line-clamp-3">{course.description}</p>
              <p className="text-xs text-muted mt-4 flex items-center gap-1.5"><GraduationCap size={14} /> {course.instructor}</p>
              <div className="mt-4 text-xs font-mono text-muted">{course.completedLessons}/{course.lessonCount} lessons completed</div>
              <Link href={`/courses/${course.id}`} className="btn btn-primary mt-5 justify-center">
                {course.enrolled ? "Continue course" : "View course"}
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
