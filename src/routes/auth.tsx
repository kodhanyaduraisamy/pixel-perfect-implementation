import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/study/Logo";
import heroImg from "@/assets/hero-lens.jpg";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · StudyLens AI" },
      { name: "description", content: "Sign in to StudyLens AI to study from your own course materials." },
      { property: "og:title", content: "Sign in · StudyLens AI" },
      { property: "og:description", content: "Sign in to StudyLens AI to study from your own course materials." },
    ],
  }),
  component: AuthPage,
});

const safePath = (p?: string) => {
  if (!p) return "/dashboard";
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/dashboard";
  } catch {
    return "/dashboard";
  }
};

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safePath(redirect), replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: safePath(redirect), replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-hero relative hidden overflow-hidden lg:block">
        <img src={heroImg} alt="" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo tone="light" />
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold text-navy-foreground">Every answer traced back to your own notes.</h2>
            <p className="mt-3 text-navy-muted">Upload lectures, slides and transcripts. StudyLens cites the exact page, slide or timestamp.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {sent ? (
            <div>
              <h1 className="text-2xl font-semibold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => { setSent(false); setMode("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin" ? "Sign in to continue learning." : "Start studying from your own materials."}
              </p>
              <Button variant="outline" className="mt-6 w-full" onClick={google} type="button">
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                  <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.5-1.68 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.96S8.78 6.56 12 6.56c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 4 14.55 3 12 3 6.98 3 3 7.03 3 12s3.98 9 9 9c5.2 0 8.65-3.65 8.65-8.8 0-.6-.07-1.05-.3-1.1z" />
                </svg>
                Continue with Google
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
              </div>
              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "New to StudyLens?" : "Already have an account?"}{" "}
                <button className="font-medium text-primary hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
