import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BookOpenText, CheckCircle2, FileText, Film, Image as ImageIcon, Loader2, Plus, Presentation, Sparkles, Trash2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, MasteryBadge, PageHeader, Panel } from "@/components/study/ui-bits";
import { useCourses, useDocuments, useTopics, type Doc } from "@/lib/queries";
import { ACCEPTED } from "@/lib/extract";
import { loadDemoCourse, processUpload, type UploadProgress } from "@/lib/ingest-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/library/")({
  head: () => ({ meta: [{ title: "Study Library · StudyLens AI" }, { name: "description", content: "Upload and organise your course materials." }] }),
  component: LibraryPage,
});

const KIND_ICON = { pdf: FileText, slides: Presentation, transcript: Film, notes: FileText, image: ImageIcon } as const;
const KIND_LABEL = { pdf: "PDF", slides: "Slides", transcript: "Video transcript", notes: "Notes", image: "Image / diagram" } as const;

function StatusPill({ d }: { d: Doc }) {
  const map: Record<string, string> = {
    ready: "bg-success/15 text-success",
    failed: "bg-destructive/10 text-destructive",
  };
  const busy = !["ready", "failed"].includes(d.status);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", map[d.status] ?? "bg-accent text-accent-foreground")}>
      {busy && <Loader2 className="size-3 animate-spin" />}
      {d.status === "ready" && <CheckCircle2 className="size-3" />}
      {d.status === "failed" && <AlertTriangle className="size-3" />}
      {d.status}
    </span>
  );
}

function LibraryPage() {
  const qc = useQueryClient();
  const { data: courses = [] } = useCourses();
  const { data: docs = [], isLoading } = useDocuments();
  const { data: topics = [] } = useTopics();
  const { data: docTopics } = useQuery({
    queryKey: ["doc-topics", docs.map((d) => d.id + d.status).join()],
    queryFn: async () => {
      const { data } = await supabase.from("chunks").select("document_id, topic_id").not("topic_id", "is", null);
      const m = new Map<string, Set<string>>();
      for (const r of data ?? []) m.set(r.document_id, (m.get(r.document_id) ?? new Set()).add(r.topic_id!));
      return m;
    },
  });
  const topicName = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  const [courseId, setCourseId] = useState<string>("");
  const activeCourse = courseId || courses[0]?.id || "";
  const [progress, setProgress] = useState<Record<string, UploadProgress>>({});
  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const [newCourse, setNewCourse] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["topics"] });
    qc.invalidateQueries({ queryKey: ["courses"] });
  };
  const report = (p: UploadProgress) => {
    setProgress((s) => ({ ...s, [p.name]: p }));
    if (p.stage === "done" || p.stage === "failed") refresh();
  };

  const createCourse = async () => {
    if (!newCourse.trim()) return;
    const { data, error } = await supabase.from("courses").insert({ name: newCourse.trim() }).select("id").single();
    if (error) return toast.error(error.message);
    setCourseId(data.id);
    setNewCourse("");
    setNewCourseOpen(false);
    refresh();
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!activeCourse) return toast.error("Create a course first.");
    refresh();
    for (const f of Array.from(files)) {
      try {
        await processUpload(f, activeCourse, report);
      } catch (e) {
        report({ name: f.name, stage: "failed", pct: 100, message: e instanceof Error ? e.message : "Upload failed" });
      }
      refresh();
    }
  };

  const loadDemo = async () => {
    setDemoBusy(true);
    try {
      const id = await loadDemoCourse(report);
      setCourseId(id);
      toast.success("Demo course loaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load demo");
    } finally {
      setDemoBusy(false);
      refresh();
    }
  };

  const removeDoc = async (d: Doc) => {
    if (!confirm(`Delete "${d.name}" and its indexed content?`)) return;
    if (d.storage_path) await supabase.storage.from("materials").remove([d.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) toast.error(error.message);
    refresh();
  };

  const activeProgress = Object.values(progress).filter((p) => p.stage !== "done");
  const courseDocs = docs.filter((d) => d.course_id === activeCourse);
  const courseTopics = topics.filter((t) => t.course_id === activeCourse);

  return (
    <>
      <PageHeader
        eyebrow="Study Library"
        title="Your course materials"
        description="Upload PDFs, slide decks (.pptx), lecture transcripts (.vtt/.srt/.txt with timestamps), notes and diagram images. Content is extracted, indexed with its page, slide or timestamp, and organised into topics."
        actions={
          <>
            <Button variant="outline" onClick={loadDemo} disabled={demoBusy}>
              {demoBusy ? <Loader2 className="animate-spin" /> : <Sparkles />} Load demo course
            </Button>
            <Button onClick={() => fileRef.current?.click()} disabled={!activeCourse}>
              <Upload /> Upload files
            </Button>
          </>
        }
      />
      <input ref={fileRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Course</span>
        {courses.length ? (
          <Select value={activeCourse} onValueChange={setCourseId}>
            <SelectTrigger className="w-72 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm">No courses yet</span>
        )}
        <Button variant="ghost" size="sm" onClick={() => setNewCourseOpen(true)}>
          <Plus /> New course
        </Button>
      </div>

      {activeProgress.length > 0 && (
        <Panel className="mb-6 space-y-3">
          {activeProgress.map((p) => (
            <div key={p.name}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{p.name}</span>
                <span className={cn("shrink-0 text-xs capitalize", p.stage === "failed" ? "text-destructive" : "text-muted-foreground")}>{p.stage}</span>
              </div>
              <Progress value={p.pct} className="mt-1.5 h-1.5" />
              {p.message && <p className={cn("mt-1 text-xs", p.stage === "failed" ? "text-destructive" : "text-muted-foreground")}>{p.message}</p>}
            </div>
          ))}
        </Panel>
      )}

      {!courses.length ? (
        <EmptyState
          icon={<BookOpenText className="size-5" />}
          title="Start with a course"
          body="Create a course and upload your materials, or load the clearly labelled demo course to try the full flow."
          action={
            <div className="flex gap-2">
              <Button onClick={() => setNewCourseOpen(true)}><Plus /> New course</Button>
              <Button variant="outline" onClick={loadDemo} disabled={demoBusy}><Sparkles /> Load demo</Button>
            </div>
          }
        />
      ) : (
        <Tabs defaultValue="docs">
          <TabsList>
            <TabsTrigger value="docs">Documents ({courseDocs.length})</TabsTrigger>
            <TabsTrigger value="topics">Topic map ({courseTopics.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="docs" className="mt-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-accent/40 px-6 py-8 text-center transition-colors hover:bg-accent"
            >
              <Upload className="size-6 text-primary" />
              <p className="mt-2 text-sm font-medium">Drop files here or click to upload</p>
              <p className="text-xs text-muted-foreground">PDF · PPTX · VTT/SRT · TXT/MD · PNG/JPG diagrams — up to 50 MB</p>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !courseDocs.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No documents in this course yet.</p>
            ) : (
              <div className="grid gap-3">
                {courseDocs.map((d) => {
                  const Icon = KIND_ICON[d.kind as keyof typeof KIND_ICON] ?? FileText;
                  const tags = [...(docTopics?.get(d.id) ?? [])].map((id) => topicName.get(id)?.name).filter(Boolean);
                  return (
                    <Panel key={d.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to="/library/$docId" params={{ docId: d.id }} className="truncate font-semibold hover:text-primary">{d.name}</Link>
                          {d.is_demo && <span className="rounded bg-warning/25 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-warning-foreground">Demo material</span>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {KIND_LABEL[d.kind as keyof typeof KIND_LABEL]} · {d.unit_count} content units{d.figure_count ? ` · ${d.figure_count} figures described` : ""}
                        </p>
                        {d.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.summary}</p>}
                        {d.error && <p className={cn("mt-1 text-xs", d.status === "failed" ? "text-destructive" : "text-warning-foreground")}>{d.error}</p>}
                        {tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {tags.map((t) => <span key={t} className="rounded-full border bg-card px-2 py-0.5 text-[11px]">{t}</span>)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill d={d} />
                        <Button asChild variant="outline" size="sm"><Link to="/library/$docId" params={{ docId: d.id }}>View content</Link></Button>
                        <Button variant="ghost" size="icon" onClick={() => removeDoc(d)} aria-label="Delete document"><Trash2 /></Button>
                      </div>
                    </Panel>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="topics" className="mt-4">
            {!courseTopics.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Topics appear here once documents are indexed.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {courseTopics.filter((t) => !t.parent_id).map((t) => {
                  const subs = courseTopics.filter((s) => s.parent_id === t.id);
                  return (
                    <Panel key={t.id}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold">{t.name}</h3>
                        <MasteryBadge p={t.p} attempts={t.attempts} />
                      </div>
                      {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">{t.units} content units</p>
                      {t.prerequisites.length > 0 && (
                        <p className="mt-2 text-xs"><span className="font-semibold">Prerequisites:</span> {t.prerequisites.join(", ")}</p>
                      )}
                      {subs.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Subtopics</p>
                          <div className="flex flex-wrap gap-1.5">
                            {subs.map((s) => <span key={s.id} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{s.name}</span>)}
                          </div>
                        </div>
                      )}
                    </Panel>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={newCourseOpen} onOpenChange={setNewCourseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New course</DialogTitle></DialogHeader>
          <Input placeholder="e.g. Organic Chemistry II" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createCourse()} autoFocus />
          <DialogFooter><Button onClick={createCourse}>Create course</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
