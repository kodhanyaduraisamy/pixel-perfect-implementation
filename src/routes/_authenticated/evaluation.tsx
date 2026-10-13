import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Loader2, Play } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/study/ui-bits";
import { DEMO_COURSE_NAME, EVAL_TEST_SET } from "@/lib/demo-material";
import { evaluateRagItem } from "@/lib/study.functions";
import { runSimulatedStudent } from "@/lib/simulation";
import { useCourses } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/evaluation")({
  head: () => ({ meta: [{ title: "Evaluation · StudyLens AI" }, { name: "description", content: "Measured RAG quality and simulated-student evaluation." }] }),
  component: EvalPage,
});

type ItemResult = Awaited<ReturnType<typeof evaluateRagItem>> & { id: string; question: string; answerable: boolean };

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

function EvalPage() {
  const qc = useQueryClient();
  const { data: courses = [] } = useCourses();
  const demo = courses.find((c) => c.name === DEMO_COURSE_NAME);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, ItemResult | "running" | "error">>({});
  const [seed, setSeed] = useState(42);
  const sim = useMemo(() => runSimulatedStudent({ seed }), [seed]);

  const { data: lastRun } = useQuery({
    queryKey: ["eval_runs"],
    queryFn: async () => (await supabase.from("eval_runs").select("*").eq("kind", "rag").order("created_at", { ascending: false }).limit(1)).data?.[0] ?? null,
  });

  const run = async () => {
    if (!demo) return;
    setRunning(true);
    setProgress({});
    const results: ItemResult[] = [];
    for (const item of EVAL_TEST_SET) {
      setProgress((p) => ({ ...p, [item.id]: "running" }));
      try {
        const r = await evaluateRagItem({ data: { question: item.question, reference: item.reference, answerable: item.answerable, courseId: demo.id } });
        const full = { ...r, id: item.id, question: item.question, answerable: item.answerable };
        results.push(full);
        setProgress((p) => ({ ...p, [item.id]: full }));
      } catch (e) {
        setProgress((p) => ({ ...p, [item.id]: "error" }));
        toast.error(`${item.id}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
    if (results.length) {
      await supabase.from("eval_runs").insert({ kind: "rag", results: results as unknown as Json });
      qc.invalidateQueries({ queryKey: ["eval_runs"] });
    }
    setRunning(false);
  };

  const stored = (lastRun?.results as unknown as ItemResult[] | undefined) ?? [];
  const live = Object.values(progress).filter((v): v is ItemResult => typeof v === "object");
  const shown = live.length ? live : stored;
  const byId = new Map(shown.map((r) => [r.id, r]));
  const avg = (k: "faithfulness" | "answer_relevancy" | "context_precision" | "context_recall") => {
    const v = shown.map((r) => r.metrics?.[k]).filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const ans = shown.filter((r) => r.answerable);
  const unans = shown.filter((r) => !r.answerable);

  return (
    <>
      <PageHeader
        eyebrow="Evaluation"
        title="Measured quality, not claims"
        description="A fixed test set of answerable and unanswerable questions against the demo course. Metrics follow the RAGAS definitions (faithfulness, answer relevancy, context precision, context recall) scored by an AI judge. Unrun tests are shown as “not run”."
        actions={
          demo ? (
            <Button onClick={run} disabled={running}>{running ? <Loader2 className="animate-spin" /> : <Play />} Run RAG evaluation</Button>
          ) : (
            <Button asChild variant="outline"><Link to="/library">Load demo course first</Link></Button>
          )
        }
      />
      <div className="mb-3 text-xs text-muted-foreground">
        {live.length ? "Showing the run in progress." : lastRun ? `Showing measured results from ${new Date(lastRun.created_at).toLocaleString()}.` : "No evaluation has been run yet — all metrics below are not run."}
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Faithfulness", avg("faithfulness")],
          ["Answer relevancy", avg("answer_relevancy")],
          ["Context precision", avg("context_precision")],
          ["Context recall", avg("context_recall")],
          ["Answered (answerable)", ans.length ? ans.filter((r) => !r.refused).length / ans.length : null],
          ["Refused (unanswerable)", unans.length ? unans.filter((r) => r.refused).length / unans.length : null],
        ].map(([label, v]) => (
          <Panel key={label as string} className="p-4">
            <p className="text-xs text-muted-foreground">{label as string}</p>
            <p className={cn("mt-1 font-display text-2xl font-semibold", v == null && "text-muted-foreground")}>{v == null ? "not run" : pct(v as number)}</p>
          </Panel>
        ))}
      </div>

      <Panel className="mb-8 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Question</th><th>Type</th><th>Status</th><th>Behaviour</th><th>Faith.</th><th>Relev.</th><th>Prec.</th><th>Recall</th></tr>
          </thead>
          <tbody>
            {EVAL_TEST_SET.map((t) => {
              const p = progress[t.id];
              const r = byId.get(t.id);
              return (
                <tr key={t.id} className="border-t align-top">
                  <td className="p-3">{t.question}{r && <details className="mt-1"><summary className="cursor-pointer text-xs text-primary">answer</summary><p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{r.answer}</p></details>}</td>
                  <td className="py-3 text-xs">{t.answerable ? "answerable" : "unanswerable"}</td>
                  <td className="py-3 text-xs">{p === "running" ? <Loader2 className="size-4 animate-spin" /> : p === "error" ? <span className="text-destructive">error</span> : r ? "measured" : <span className="text-muted-foreground">not run</span>}</td>
                  <td className="py-3 text-xs">{r ? <span className={r.correctBehaviour ? "text-success" : "text-destructive"}>{r.refused ? "refused" : "answered"} {r.correctBehaviour ? "✓" : "✗"}</span> : "—"}</td>
                  <td className="py-3 font-mono text-xs">{pct(r?.metrics?.faithfulness)}</td>
                  <td className="py-3 font-mono text-xs">{pct(r?.metrics?.answer_relevancy)}</td>
                  <td className="py-3 font-mono text-xs">{pct(r?.metrics?.context_precision)}</td>
                  <td className="py-3 font-mono text-xs">{pct(r?.metrics?.context_recall)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold"><FlaskConical className="size-5 text-primary" /> Simulated-student evaluation</h2>
          <p className="mt-1 text-sm text-muted-foreground">A simulated learner with known true skills answers {sim.questionsPerTopic} adaptive questions per topic. This is a simulation computed in your browser (seed {sim.seed}) and is repeatable.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSeed((s) => s + 1)}>New seed</Button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        {[
          ["Mean abs. error (start)", pct(sim.initialMeanAbsError)],
          ["Mean abs. error (end)", pct(sim.meanAbsError)],
          ["Topic ranking agreement", pct(sim.rankAgreement)],
          ["Question repeats (avoid / naive)", `${pct(sim.repeatRateWithAvoidance)} / ${pct(sim.repeatRateWithoutAvoidance)}`],
        ].map(([l, v]) => <Panel key={l} className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 font-display text-xl font-semibold">{v}</p></Panel>)}
      </div>
      <Panel className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="p-3">Topic</th><th>True skill</th><th>Estimated</th><th>Error</th><th>Label</th></tr></thead>
          <tbody>{sim.topics.map((t) => <tr key={t.topic} className="border-t"><td className="p-3">{t.topic}</td><td className="font-mono text-xs">{pct(t.trueSkill)}</td><td className="font-mono text-xs">{pct(t.estimate)}</td><td className="font-mono text-xs">{pct(t.absError)}</td><td className="text-xs">{t.level}</td></tr>)}</tbody>
        </table>
      </Panel>
    </>
  );
}
