import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenText, Layers, Sparkles, Target, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, MasteryBadge, MasteryBar, PageHeader, Panel, ProgressRing } from "@/components/study/ui-bits";
import { useCourses, useDocuments, useQuizzes, useTopics, useUser } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · StudyLens AI" }, { name: "description", content: "Your learning progress at a glance." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: user } = useUser();
  const { data: docs = [] } = useDocuments();
  const { data: topics = [] } = useTopics();
  const { data: quizzes = [] } = useQuizzes();
  const { data: courses = [] } = useCourses();

  const ready = docs.filter((d) => d.status === "ready");
  const units = ready.reduce((s, d) => s + d.unit_count, 0);
  const assessed = topics.filter((t) => t.attempts > 0);
  const overall = assessed.length ? assessed.reduce((s, t) => s + t.p, 0) / assessed.length : null;
  const weak = assessed.filter((t) => t.p < 0.5).sort((a, b) => a.p - b.p);
  const unassessed = topics.filter((t) => t.attempts === 0);
  const done = quizzes.filter((q) => q.completed_at);
  const firstName = ((user?.user_metadata?.full_name as string) || user?.email || "").split(/[ @]/)[0];

  const rec = weak[0]
    ? { title: `Revise ${weak[0].name}`, body: `Mastery is ${Math.round(weak[0].p * 100)}%. Review the cited passages, then take a focused quiz.`, to: "/quiz" as const, search: { topic: weak[0].id }, cta: "Practise this topic" }
    : unassessed.length
      ? { title: "Take a diagnostic quiz", body: `${unassessed.length} topics haven't been assessed yet. A short diagnostic sets your starting point.`, to: "/quiz" as const, search: { diagnostic: true }, cta: "Start diagnostic" }
      : topics.length
        ? { title: "Push to the next level", body: "All assessed topics are on track. Try an adaptive quiz to keep mastery fresh.", to: "/quiz" as const, search: {}, cta: "Adaptive quiz" }
        : { title: "Build your library", body: "Upload lecture notes, slides or transcripts — or load the demo course.", to: "/library" as const, search: {}, cta: "Open library" };

  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`Welcome back${firstName ? `, ${firstName}` : ""}`} description="Your materials, mastery and next best step." />

      <div className="bg-hero relative mb-6 overflow-hidden rounded-3xl p-6 text-navy-foreground md:p-8">
        <div className="grid-dots absolute inset-0 opacity-60" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <ProgressRing value={overall} size={128} stroke={11} tone="navy" label={<><span className="font-display text-2xl font-semibold">{overall == null ? "—" : `${Math.round(overall * 100)}%`}</span><span className="text-[10px] uppercase tracking-wider text-navy-muted">mastery</span></>} />
          <div className="flex-1">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary-glow">Recommended next session</p>
            <h2 className="mt-1 text-2xl font-semibold">{rec.title}</h2>
            <p className="mt-1 max-w-xl text-sm text-navy-muted">{rec.body}</p>
          </div>
          <Button asChild size="lg" className="bg-gradient-primary shadow-elegant">
            <Link to={rec.to} search={rec.search}>Continue Learning <ArrowRight /></Link>
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: BookOpenText, label: "Study materials", value: ready.length, sub: `${docs.length - ready.length} processing / failed` },
          { icon: Layers, label: "Indexed content units", value: units, sub: `${courses.length} courses` },
          { icon: Target, label: "Topics assessed", value: `${assessed.length}/${topics.length}`, sub: `${unassessed.length} not assessed` },
          { icon: Sparkles, label: "Quizzes completed", value: done.length, sub: done[0] ? `Last: ${done[0].score}/${done[0].total}` : "None yet" },
        ].map(({ icon: Icon, label, value, sub }) => (
          <Panel key={label}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className="size-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </Panel>
        ))}
      </div>

      {!topics.length ? (
        <EmptyState icon={<BookOpenText className="size-5" />} title="No topics yet" body="Upload materials to build your topic map." action={<Button asChild><Link to="/library">Open library</Link></Button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h3 className="mb-3 font-semibold">Topic mastery</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {topics.slice(0, 8).map((t) => (
                <Panel key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{t.name}</p>
                    <MasteryBadge p={t.p} attempts={t.attempts} />
                  </div>
                  <div className="mt-3"><MasteryBar p={t.p} attempts={t.attempts} /></div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t.attempts ? `${Math.round(t.p * 100)}% · ${t.correct}/${t.attempts} correct` : "Not assessed"} · {t.units} units
                  </p>
                </Panel>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <Panel>
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><TrendingDown className="size-4 text-destructive" /> Needs revision</h3>
              {!weak.length ? <p className="text-sm text-muted-foreground">No weak topics detected yet.</p> : weak.slice(0, 5).map((t) => (
                <Link key={t.id} to="/quiz" search={{ topic: t.id }} className="flex items-center justify-between border-b py-2 text-sm last:border-0 hover:text-primary">
                  {t.name} <span className="font-mono text-xs">{Math.round(t.p * 100)}%</span>
                </Link>
              ))}
            </Panel>
            <Panel>
              <h3 className="mb-3 font-semibold">Recent quiz results</h3>
              {!done.length ? <p className="text-sm text-muted-foreground">No quizzes completed.</p> : done.slice(0, 5).map((q) => (
                <Link key={q.id} to="/quiz/$quizId" params={{ quizId: q.id }} className="flex items-center justify-between border-b py-2 text-sm last:border-0 hover:text-primary">
                  <span className="capitalize">{q.is_diagnostic ? "Diagnostic" : q.difficulty}</span>
                  <span className="font-mono text-xs">{q.score}/{q.total}</span>
                </Link>
              ))}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
