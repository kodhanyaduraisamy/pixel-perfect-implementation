import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenText, GraduationCap, LineChart, Quote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/study/Logo";
import heroImg from "@/assets/hero-lens.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyLens AI — Tutoring grounded in your own course materials" },
      {
        name: "description",
        content: "Upload lectures, slides and transcripts. Get source-cited answers, verified adaptive quizzes and a personal revision plan.",
      },
      { property: "og:title", content: "StudyLens AI — Tutoring grounded in your own course materials" },
      { property: "og:description", content: "Source-cited AI tutoring, adaptive quizzes and mastery tracking from your own study materials." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: BookOpenText, title: "Your library, indexed", body: "PDFs, slide decks, lecture transcripts and diagrams — organised into topics and prerequisites." },
  { icon: Quote, title: "Answers with receipts", body: "Every claim cites the document and page, slide or timestamp. If it isn't in your notes, we say so." },
  { icon: GraduationCap, title: "Verified adaptive quizzes", body: "Questions generated from your content, with answer keys checked against the source passage." },
  { icon: LineChart, title: "Explainable mastery", body: "A transparent Bayesian model tracks each topic and recommends what to revise next." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <section className="bg-hero relative overflow-hidden">
        <img src={heroImg} alt="Open textbook dissolving into a network of glowing ideas" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/20" />
        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-8 md:px-10">
          <header className="flex items-center justify-between">
            <Logo tone="light" />
            <Button asChild variant="secondary" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          </header>
          <div className="mt-20 max-w-2xl md:mt-28">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary-glow">Multimodal AI Hackathon 2026 · Track D</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] text-navy-foreground md:text-6xl">
              Study smarter from <span className="text-gradient">your own materials.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-navy-muted">
              StudyLens turns your lectures, slides and transcripts into a tutor that cites its sources, quizzes you adaptively and knows exactly what to revise next.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-primary shadow-elegant">
                <Link to="/dashboard">
                  Start learning <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-16 sm:grid-cols-2 md:px-10 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="surface rounded-2xl border p-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">StudyLens AI · Upload → Index → Ask → Quiz → Master</footer>
    </div>
  );
}
