import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, CheckCircle2, ExternalLink, Loader2, ShieldAlert, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MasteryBadge, PageHeader, Panel, ProgressRing } from "@/components/study/ui-bits";
import { answerQuestion, finishQuiz } from "@/lib/study.functions";
import { formatLocation } from "@/lib/extract";
import { useTopics } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quiz/$quizId")({
  head: () => ({ meta: [{ title: "Quiz · StudyLens AI" }] }),
  component: QuizPage,
});

function useQuizData(quizId: string) {
  return useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      const { data: quiz, error } = await supabase.from("quizzes").select("*").eq("id", quizId).single();
      if (error) throw new Error(error.message);
      const [{ data: qs }, { data: at }] = await Promise.all([
        supabase.from("questions").select("*, chunks(id, page, slide, ts_start, ts_end, content, document_id, documents(name))").in("id", quiz.question_ids),
        supabase.from("attempts").select("*").eq("quiz_id", quizId),
      ]);
      const order = new Map(quiz.question_ids.map((id, i) => [id, i]));
      return { quiz, questions: (qs ?? []).sort((a, b) => order.get(a.id)! - order.get(b.id)!), attempts: at ?? [] };
    },
  });
}

function QuizPage() {
  const { quizId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuizData(quizId);
  const { data: topics = [] } = useTopics();
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Awaited<ReturnType<typeof answerQuestion>> | null>(null);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading quiz…</p>;
  const { quiz, questions, attempts } = data;
  const answered = new Map(attempts.map((a) => [a.question_id, a]));
  const idx = questions.findIndex((q) => !answered.has(q.id));
  const tName = new Map(topics.map((t) => [t.id, t]));

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["topics"] });
    qc.invalidateQueries({ queryKey: ["quizzes"] });
    qc.invalidateQueries({ queryKey: ["mastery_events"] });
  };

  // Results view
  if (idx === -1 && !feedback) {
    if (!quiz.completed_at) {
      finishQuiz({ data: { quizId } }).then(() => { refetch(); refreshAll(); });
    }
    const score = attempts.filter((a) => a.correct).length;
    const wrong = questions.filter((q) => !answered.get(q.id)?.correct);
    const weakTopicIds = [...new Set(wrong.map((q) => q.topic_id).filter(Boolean))] as string[];
    return (
      <>
        <PageHeader eyebrow={quiz.is_diagnostic ? "Diagnostic results" : "Quiz results"} title={`You scored ${score} of ${questions.length}`} description={quiz.generation_note ?? undefined} actions={<Button asChild><Link to="/quiz">New quiz</Link></Button>} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel className="flex flex-col items-center justify-center">
            <ProgressRing value={questions.length ? score / questions.length : 0} size={140} stroke={12} />
            <p className="mt-3 text-sm text-muted-foreground capitalize">{quiz.difficulty} difficulty</p>
          </Panel>
          <Panel className="lg:col-span-2">
            <h3 className="font-semibold">Weak topics & recommended revision</h3>
            {!weakTopicIds.length ? (
              <p className="mt-2 text-sm text-muted-foreground">No weak topics in this quiz — try a harder difficulty next.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {weakTopicIds.map((id) => {
                  const t = tName.get(id);
                  return (
                    <div key={id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
                      <span className="font-medium">{t?.name ?? "Topic"}</span>
                      {t && <MasteryBadge p={t.p} attempts={t.attempts} />}
                      <div className="ml-auto flex gap-2">
                        <Button asChild size="sm" variant="outline"><Link to="/tutor">Ask tutor</Link></Button>
                        <Button asChild size="sm"><Link to="/quiz" search={{ topic: id }}>Practise</Link></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
        <h3 className="mb-3 mt-8 font-semibold">Review & misconceptions</h3>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const a = answered.get(q.id);
            const opts = q.options as string[];
            const c = q.chunks;
            return (
              <Panel key={q.id}>
                <div className="flex items-start gap-2">
                  {a?.correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />}
                  <div className="min-w-0">
                    <p className="font-medium">{i + 1}. {q.stem}</p>
                    {!a?.correct && a && <p className="mt-1 text-sm text-destructive">Your answer: {opts[a.selected_index]}</p>}
                    <p className="mt-1 text-sm text-success">Correct: {opts[q.correct_index]}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{q.explanation}</p>
                    {c && <p className="mt-2 text-xs text-muted-foreground">Source: {c.documents?.name} {formatLocation({ ...c, ts_start: c.ts_start == null ? null : Number(c.ts_start), ts_end: c.ts_end == null ? null : Number(c.ts_end) })}</p>}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </>
    );
  }

  const q = questions[feedback ? questions.findIndex((x) => x.id === (feedback as unknown as { qid: string }).qid) : idx] ?? questions[idx];
  const current = feedback ? questions.find((x) => x.id === (feedback as unknown as { qid: string }).qid)! : q;
  const opts = current.options as string[];
  const c = current.chunks;
  const position = questions.indexOf(current) + 1;

  const submit = async () => {
    if (selected == null) return;
    setBusy(true);
    try {
      const res = await answerQuestion({ data: { quizId, questionId: current.id, selected } });
      setFeedback({ ...res, qid: current.id } as typeof res);
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  };
  const next = async () => {
    setFeedback(null);
    setSelected(null);
    await refetch();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Question {position} of {questions.length}</span>
          <span className="capitalize text-muted-foreground">{current.difficulty} · {current.topic_id ? tName.get(current.topic_id)?.name : "General"}</span>
        </div>
        <Progress value={(attempts.length / questions.length) * 100} className="h-1.5" />
      </div>
      <Panel className="p-6 md:p-8">
        <div className="mb-3 flex items-center gap-2 text-xs">
          {current.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 font-semibold text-success"><BadgeCheck className="size-3.5" /> Answer key verified</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 font-semibold text-warning-foreground"><ShieldAlert className="size-3.5" /> Not verified</span>
          )}
          {c && <span className="text-muted-foreground">from {c.documents?.name} {formatLocation({ ...c, ts_start: c.ts_start == null ? null : Number(c.ts_start), ts_end: c.ts_end == null ? null : Number(c.ts_end) })}</span>}
        </div>
        <h2 className="text-xl font-semibold leading-snug">{current.stem}</h2>
        <div className="mt-6 space-y-2.5">
          {opts.map((o, i) => {
            const isCorrect = feedback && i === feedback.correctIndex;
            const isWrongPick = feedback && i === selected && !feedback.correct;
            return (
              <button
                key={i}
                disabled={!!feedback}
                onClick={() => setSelected(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left text-sm transition",
                  !feedback && selected === i && "border-primary bg-accent",
                  !feedback && "hover:border-primary/50",
                  isCorrect && "border-success bg-success/10",
                  isWrongPick && "border-destructive bg-destructive/10",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-xs">{String.fromCharCode(65 + i)}</span>
                {o}
              </button>
            );
          })}
        </div>
        {feedback && (
          <div className={cn("mt-6 rounded-xl border p-4", feedback.correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5")}>
            <p className="font-semibold">{feedback.correct ? "Correct!" : "Not quite."}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{feedback.explanation}</p>
            <blockquote className="mt-3 border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">“{feedback.evidence}”</blockquote>
            {c && (
              <Link to="/library/$docId" params={{ docId: c.document_id }} search={{ chunk: c.id }} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                {c.documents?.name} · {formatLocation({ ...c, ts_start: c.ts_start == null ? null : Number(c.ts_start), ts_end: c.ts_end == null ? null : Number(c.ts_end) })} <ExternalLink className="size-3" />
              </Link>
            )}
            {feedback.mastery && (
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                Mastery {Math.round(feedback.mastery.before * 100)}% → {Math.round(feedback.mastery.after * 100)}%
              </p>
            )}
          </div>
        )}
        <div className="mt-6 flex justify-end">
          {feedback ? (
            <Button onClick={next}>{position === questions.length ? "See results" : "Next question"} <ArrowRight /></Button>
          ) : (
            <Button onClick={submit} disabled={selected == null || busy}>{busy && <Loader2 className="animate-spin" />} Check answer</Button>
          )}
        </div>
      </Panel>
    </div>
  );
}
