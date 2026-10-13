import { cn } from "@/lib/utils";

/** StudyLens mark: a lens over an open page. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex size-9 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant", className)}>
      <svg viewBox="0 0 24 24" className="size-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 6.5c2.5-1 5-1 7 .5v11c-2-1.5-4.5-1.5-7-.5z" />
        <path d="M10 7c1-.8 2.2-1.2 3.5-1.3" />
        <circle cx="17" cy="12.5" r="3.5" />
        <path d="m19.6 15.1 2 2" />
      </svg>
    </div>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("font-display text-lg font-semibold tracking-tight", tone === "light" ? "text-navy-foreground" : "text-foreground")}>
        StudyLens<span className="text-primary"> AI</span>
      </span>
    </div>
  );
}
