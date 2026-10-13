import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LEVEL_LABEL, masteryLevel, type MasteryLevel } from "@/lib/mastery";

export function ProgressRing({
  value,
  size = 96,
  stroke = 9,
  label,
  className,
  tone = "primary",
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  className?: string;
  tone?: "primary" | "navy";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" className={tone === "navy" ? "stroke-navy-foreground/15" : "stroke-muted"} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label ?? <span className="font-display text-xl font-semibold">{value == null ? "—" : `${Math.round(v * 100)}%`}</span>}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const LEVEL_STYLE: Record<MasteryLevel, string> = {
  unassessed: "bg-muted text-muted-foreground",
  "needs-work": "bg-destructive/10 text-destructive",
  developing: "bg-warning/20 text-warning-foreground",
  mastered: "bg-success/15 text-success",
};

export function MasteryBadge({ p, attempts }: { p: number; attempts: number }) {
  const lvl = masteryLevel(p, attempts);
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", LEVEL_STYLE[lvl])}>{LEVEL_LABEL[lvl]}</span>;
}

export function MasteryBar({ p, attempts }: { p: number; attempts: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", attempts === 0 ? "bg-muted-foreground/30" : "bg-gradient-primary")}
        style={{ width: attempts === 0 ? "100%" : `${Math.round(p * 100)}%` }}
      />
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("surface rounded-2xl border p-5", className)}>{children}</div>;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
