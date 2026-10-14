import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  BookOpenText,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Settings,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/study/Logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch (e) {
      // Backend not configured in this build (e.g. stale publish): fall back to the landing page.
      console.error(e);
      throw redirect({ to: "/" });
    }
    if (!user) throw redirect({ to: "/auth", search: { redirect: location.href } });
  },
  component: AppShell,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/library", label: "Study Library", icon: BookOpenText },
  { to: "/tutor", label: "AI Tutor", icon: MessagesSquare },
  { to: "/quiz", label: "Adaptive Quiz", icon: GraduationCap },
  { to: "/insights", label: "Learning Insights", icon: BarChart3 },
  { to: "/evaluation", label: "Evaluation", icon: FlaskConical },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = path === to || path.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className={cn("size-4.5", active ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-primary")} />
            {label}
            {active && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  return (
    <div className="grid-dots flex h-full flex-col bg-sidebar p-4 text-sidebar-foreground">
      <div className="px-2 pb-6 pt-2">
        <Logo tone="light" />
      </div>
      <NavList onNavigate={onNavigate} />
      <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
        <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{name}</p>
        <p className="text-xs text-sidebar-foreground/60">Track D · Adaptive learning</p>
        <button onClick={signOut} className="mt-2 flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-primary">
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarBody />
      </aside>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu />
        </Button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-none p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
