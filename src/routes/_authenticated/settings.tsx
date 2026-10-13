import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel } from "@/components/study/ui-bits";
import { getAiStatus } from "@/lib/study.functions";
import { useCourses, useUser } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · StudyLens AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: user } = useUser();
  const { data: courses = [] } = useCourses();
  const { data: ai } = useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus() });
  const [name, setName] = useState("");
  const [level, setLevel] = useState("intermediate");
  useEffect(() => setName((user?.user_metadata?.full_name as string) ?? ""), [user]);
  useEffect(() => setLevel(localStorage.getItem("sl-level") ?? "intermediate"), []);

  const save = async () => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    localStorage.setItem("sl-level", level);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["user"] });
  };
  const resetProgress = async () => {
    if (!confirm("Reset all mastery, quizzes and attempts? Your documents stay.")) return;
    await supabase.from("mastery_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("mastery").delete().neq("p_mastery", -1);
    await supabase.from("quizzes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    qc.invalidateQueries();
    toast.success("Progress reset");
  };
  const deleteCourse = async (id: string, n: string) => {
    if (!confirm(`Delete course "${n}" with all documents, topics and quizzes?`)) return;
    const { data: docs } = await supabase.from("documents").select("storage_path").eq("course_id", id);
    const paths = (docs ?? []).map((d) => d.storage_path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("materials").remove(paths);
    await supabase.from("courses").delete().eq("id", id);
    qc.invalidateQueries();
  };
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <>
      <PageHeader eyebrow="Settings" title="Account & preferences" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <h3 className="font-semibold">Profile</h3>
          <div className="space-y-1.5"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div className="space-y-1.5"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Default explanation level</Label>
            <div className="flex gap-2">
              {["beginner", "intermediate", "advanced"].map((l) => (
                <Button key={l} size="sm" variant={level === l ? "default" : "outline"} onClick={() => setLevel(l)} className="capitalize">{l}</Button>
              ))}
            </div>
          </div>
          <Button onClick={save}>Save changes</Button>
        </Panel>
        <Panel className="space-y-3">
          <h3 className="font-semibold">Service status</h3>
          <div className="flex items-center gap-2 text-sm">
            {ai?.configured ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
            AI features {ai == null ? "checking…" : ai.configured ? "configured" : "not configured — tutor, quizzes and figure reading are unavailable; library browsing still works."}
          </div>
          <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-success" /> Database, sign-in and file storage connected</div>
        </Panel>
        <Panel className="space-y-3">
          <h3 className="font-semibold">Courses</h3>
          {!courses.length && <p className="text-sm text-muted-foreground">No courses.</p>}
          {courses.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
              {c.name}
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteCourse(c.id, c.name)}>Delete</Button>
            </div>
          ))}
        </Panel>
        <Panel className="space-y-3">
          <h3 className="font-semibold">Danger zone</h3>
          <Button variant="outline" onClick={resetProgress}>Reset learning progress</Button>
          <Button variant="destructive" onClick={signOut}>Sign out</Button>
        </Panel>
      </div>
    </>
  );
}
