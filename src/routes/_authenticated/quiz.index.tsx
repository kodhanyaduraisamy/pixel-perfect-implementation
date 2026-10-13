import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Loader2, Stethoscope } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { EmptyState, PageHeader, Panel } from "@/components/study/ui-bits";
import { useCourses, useQuizzes, useTopics } from "@/lib/queries";
import { generateQuiz } from "@/lib/study.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quiz/")({
  validateSearch: z.object({ topic: z.string().optional(), diagnostic: z.boolean().optional() }),
  head: () => ({ meta: [{ title: "Adaptive Quiz · StudyLens AI" }, { name: "description", content: "Verified quizzes generated from your materials." }] }),
  component: QuizSetup,
});

function QuizSetup() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: courses = [] } = useCourses();
  const { data: topics = [] } = useTopics();
  const { data: quizzes = [] } = useQuizzes();
  const preTopic = topics.find((t) => t.id === search.topic);
  const [courseId, setCourseId] = useState("");
  const [topicId, setTopicId] = useState<string>(search.topic ?? "all");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"adaptive" | "easy" | "medium" | "hard">("adaptive");
  const [busy, setBusy] = useState(false);
  const course = courseId || preTopic?.course_id || courses[0]?.id || "";
  const courseTopics = topics.filter((t) => t.course_id === course);

  const start = async (diagnostic: boolean) => {
    if (!course) return;
    setBusy(true);
    try {
      const { quizId } = await generateQuiz({
        data: { courseId: course, topicId: diagnostic || topicId === "all" ? null : topicId, count: diagnostic ? Math.min(10, Math.max(4, courseTopics.length)) : count, difficulty, diagnostic },
      });
      navigate({ to: "/quiz/$quizId", params: { quizId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Quiz generation failed");
    } finally {
      setBusy(false);
    }
  };

  if (!courses.length)
    return (
      <>
        <PageHeader eyebrow="Adaptive Quiz" title="Test what you know" />
        <EmptyState icon={<GraduationCap className="size-5" />} title="No course material yet" body="Upload material or load the demo course to generate quizzes." action={<Button asChild><Link to="/library">Go to library</Link></Button>} />
      </>
    );

  return (
    <>
      <PageHeader eyebrow="Adaptive Quiz" title="Build a quiz from your materials" description="Questions are generated from retrieved passages. Each answer key is checked against the source: the evidence quote must exist in the passage and an independent solver must agree. Failing questions are discarded." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Course</p>
              <Select value={course} onValueChange={(v) => { setCourseId(v); setTopicId("all"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Topic</p>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All topics</SelectItem>
                  {courseTopics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Number of questions: <span className="text-primary">{count}</span></p>
            <Slider min={1} max={10} step={1} value={[count]} onValueChange={(v) => setCount(v[0])} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Difficulty</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["adaptive", "easy", "medium", "hard"] as const).map((d) => (
                <button key={d} onClick={() => setDifficulty(d)} className={cn("rounded-xl border p-3 text-left text-sm capitalize transition", difficulty === d ? "border-primary bg-accent" : "bg-card hover:border-primary/50")}>
                  <span className="font-semibold">{d}</span>
                  {d === "adaptive" && <span className="block text-xs text-muted-foreground">Matched to your mastery</span>}
                </button>
              ))}
            </div>
          </div>
          <Button size="lg" className="w-full bg-gradient-primary" onClick={() => start(false)} disabled={busy}>
            {busy ? <><Loader2 className="animate-spin" /> Generating & verifying questions…</> : <><GraduationCap /> Generate quiz</>}
          </Button>
        </Panel>
        <div className="space-y-6">
          <Panel className="bg-hero border-none text-navy-foreground">
            <Stethoscope className="size-6 text-primary-glow" />
            <h3 className="mt-3 font-semibold">Diagnostic quiz</h3>
            <p className="mt-1 text-sm text-navy-muted">New topics start as “not assessed”. A diagnostic samples one question per topic to set your starting mastery.</p>
            <Button variant="secondary" className="mt-4 w-full" onClick={() => start(true)} disabled={busy}>Start diagnostic</Button>
          </Panel>
          <Panel>
            <h3 className="mb-3 font-semibold">Recent quizzes</h3>
            {!quizzes.length ? <p className="text-sm text-muted-foreground">None yet.</p> : (
              <div className="space-y-2">
                {quizzes.slice(0, 6).map((q) => (
                  <Link key={q.id} to="/quiz/$quizId" params={{ quizId: q.id }} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary">
                    <span className="capitalize">{q.is_diagnostic ? "Diagnostic" : q.difficulty} · {new Date(q.created_at).toLocaleDateString()}</span>
                    <span className="font-mono text-xs">{q.completed_at ? `${q.score}/${q.total}` : "in progress"}</span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
