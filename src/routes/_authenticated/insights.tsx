import { createFileRoute, Link } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";

import { Button } from "@/components/ui/button";
import { MasteryBadge, PageHeader, Panel } from "@/components/study/ui-bits";
import { useMasteryEvents, useQuizzes, useTopics } from "@/lib/queries";
import { BKT_PARAMS, LEARN_RATE, PRIOR_MASTERY } from "@/lib/mastery";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Learning Insights · StudyLens AI" }, { name: "description", content: "Mastery trends and personalised recommendations." }] }),
  component: Insights,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Insights() {
  const { data: topics = [] } = useTopics();
  const { data: events = [] } = useMasteryEvents();
  const { data: quizzes = [] } = useQuizzes();
  const tName = new Map(topics.map((t) => [t.id, t.name]));

  const trendTopics = [...new Set(events.map((e) => e.topic_id))].slice(0, 5);
  const latest: Record<string, number> = {};
  const trend = events.map((e, i) => {
    latest[e.topic_id] = e.p_after;
    const row: Record<string, number> = { step: i + 1 };
    for (const t of trendTopics) if (latest[t] != null) row[tName.get(t) ?? t] = Math.round(latest[t] * 100);
    return row;
  });
  const quizData = quizzes.filter((q) => q.completed_at).reverse().map((q, i) => ({ n: `#${i + 1}`, score: Math.round((q.score / Math.max(1, q.total)) * 100) }));
  const assessed = topics.filter((t) => t.attempts > 0).sort((a, b) => a.p - b.p);
  const unassessed = topics.filter((t) => t.attempts === 0);

  return (
    <>
      <PageHeader eyebrow="Learning Insights" title="How your understanding is evolving" description="Mastery is estimated per topic with Bayesian Knowledge Tracing and updated after every answer." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h3 className="mb-4 font-semibold">Mastery trend (per answer)</h3>
          {!trend.length ? <p className="text-sm text-muted-foreground">Answer quiz questions to see your trend.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="step" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                {trendTopics.map((t, i) => <Line key={t} type="monotone" dataKey={tName.get(t) ?? t} stroke={COLORS[i]} strokeWidth={2} dot={false} connectNulls />)}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel>
          <h3 className="mb-4 font-semibold">Quiz history</h3>
          {!quizData.length ? <p className="text-sm text-muted-foreground">No completed quizzes yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={quizData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="n" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="score" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel>
          <h3 className="mb-3 font-semibold">Personalised recommendations</h3>
          <div className="space-y-2">
            {assessed.filter((t) => t.p < 0.75).slice(0, 4).map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
                <span className="font-medium">{t.name}</span><MasteryBadge p={t.p} attempts={t.attempts} />
                <span className="text-xs text-muted-foreground">{t.prerequisites.length ? `Review first: ${t.prerequisites.join(", ")}` : ""}</span>
                <Button asChild size="sm" className="ml-auto"><Link to="/quiz" search={{ topic: t.id }}>Practise</Link></Button>
              </div>
            ))}
            {unassessed.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border bg-accent p-3 text-sm">
                {unassessed.length} topics not assessed yet.
                <Button asChild size="sm" variant="outline" className="ml-auto"><Link to="/quiz" search={{ diagnostic: true }}>Diagnostic</Link></Button>
              </div>
            )}
            {!topics.length && <p className="text-sm text-muted-foreground">Upload materials to get recommendations.</p>}
          </div>
        </Panel>
        <Panel>
          <h3 className="mb-2 font-semibold">How mastery is calculated</h3>
          <p className="text-sm text-muted-foreground">
            Each topic starts at P(mastered) = {PRIOR_MASTERY} and is labelled “not assessed” until you answer a question. After each answer, Bayes’ rule updates the estimate using a guess and slip probability that depend on difficulty, then a learning step of {LEARN_RATE} is applied.
          </p>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th>Difficulty</th><th>Guess</th><th>Slip</th></tr></thead>
            <tbody>{Object.entries(BKT_PARAMS).map(([d, p]) => <tr key={d} className="border-t"><td className="py-1.5 capitalize">{d}</td><td>{p.guess}</td><td>{p.slip}</td></tr>)}</tbody>
          </table>
          <p className="mt-3 font-mono text-xs text-muted-foreground">correct: p·(1−s) / (p·(1−s) + (1−p)·g)<br />wrong: p·s / (p·s + (1−p)·(1−g))<br />then p ← p + (1−p)·{LEARN_RATE}</p>
        </Panel>
      </div>
    </>
  );
}
