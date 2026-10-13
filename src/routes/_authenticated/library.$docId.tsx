import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import { ArrowLeft, ExternalLink, ImageIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/study/ui-bits";
import { formatLocation } from "@/lib/extract";
import { useTopics } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/library/$docId")({
  validateSearch: z.object({ chunk: z.string().optional() }),
  head: () => ({ meta: [{ title: "Source viewer · StudyLens AI" }] }),
  component: DocPage,
});

function DocPage() {
  const { docId } = Route.useParams();
  const { chunk } = Route.useSearch();
  const { data: topics = [] } = useTopics();
  const { data, isLoading } = useQuery({
    queryKey: ["doc", docId],
    queryFn: async () => {
      const [doc, chunks] = await Promise.all([
        supabase.from("documents").select("*").eq("id", docId).single(),
        supabase.from("chunks").select("*").eq("document_id", docId).order("seq"),
      ]);
      if (doc.error) throw new Error(doc.error.message);
      let url: string | null = null;
      if (doc.data.storage_path) {
        const s = await supabase.storage.from("materials").createSignedUrl(doc.data.storage_path, 3600);
        url = s.data?.signedUrl ?? null;
      }
      return { doc: doc.data, chunks: chunks.data ?? [], url };
    },
  });

  useEffect(() => {
    if (chunk && data) document.getElementById(`chunk-${chunk}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [chunk, data]);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const { doc, chunks, url } = data;
  const tName = new Map(topics.map((t) => [t.id, t.name]));
  const highlighted = chunks.find((c) => c.id === chunk);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/library"><ArrowLeft /> Library</Link>
      </Button>
      <PageHeader
        eyebrow={doc.is_demo ? "Demo material" : doc.kind}
        title={doc.name}
        description={doc.summary ?? undefined}
        actions={
          url ? (
            <Button asChild variant="outline">
              <a href={`${url}${doc.kind === "pdf" && highlighted?.page ? `#page=${highlighted.page}` : ""}`} target="_blank" rel="noreferrer">
                <ExternalLink /> Open original{highlighted?.page ? ` at p. ${highlighted.page}` : ""}
              </a>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">{doc.is_demo ? "Demo text only — no original file" : "Original file unavailable"}</span>
          )
        }
      />
      {doc.error && <Panel className="mb-4 border-warning/40 text-sm">{doc.error}</Panel>}
      <p className="mb-3 text-sm text-muted-foreground">{chunks.length} extracted content units, each kept with its source location.</p>
      <div className="space-y-3">
        {chunks.map((c) => (
          <div
            key={c.id}
            id={`chunk-${c.id}`}
            className={cn("surface rounded-xl border p-4 transition-all", c.id === chunk && "ring-2 ring-primary")}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-navy px-1.5 py-0.5 font-mono text-navy-foreground">{formatLocation({ ...c, ts_start: c.ts_start == null ? null : Number(c.ts_start), ts_end: c.ts_end == null ? null : Number(c.ts_end) }) || `unit ${c.seq + 1}`}</span>
              {c.kind === "figure" && (
                <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-accent-foreground"><ImageIcon className="size-3" /> AI figure description</span>
              )}
              {c.topic_id && <span className="rounded-full border px-2 py-0.5">{tName.get(c.topic_id)}</span>}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
          </div>
        ))}
      </div>
    </>
  );
}
