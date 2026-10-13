import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { formatLocation } from "./extract";

export const REFUSAL = "I couldn't verify this from your uploaded materials.";

export interface RetrievedSource {
  n: number;
  chunk_id: string;
  document_id: string;
  document_name: string;
  content: string;
  page: number | null;
  slide: number | null;
  ts_start: number | null;
  ts_end: number | null;
  kind: string;
  topic_id: string | null;
  location: string;
}

export async function retrieve(
  supabase: SupabaseClient<Database>,
  query: string,
  opts: { courseId?: string | null; topicId?: string | null; k?: number } = {},
): Promise<RetrievedSource[]> {
  const { data, error } = await supabase.rpc("search_chunks", {
    q: query.slice(0, 2000),
    p_course: opts.courseId ?? undefined,
    p_topic: opts.topicId ?? undefined,
    k: opts.k ?? 6,
  });
  if (error) throw new Error(`Retrieval failed: ${error.message}`);
  return (data ?? []).map((r, i) => ({
    n: i + 1,
    chunk_id: r.id,
    document_id: r.document_id,
    document_name: r.document_name,
    content: r.content,
    page: r.page,
    slide: r.slide,
    ts_start: r.ts_start == null ? null : Number(r.ts_start),
    ts_end: r.ts_end == null ? null : Number(r.ts_end),
    kind: r.kind,
    topic_id: r.topic_id,
    location: formatLocation({
      page: r.page,
      slide: r.slide,
      ts_start: r.ts_start == null ? null : Number(r.ts_start),
      ts_end: r.ts_end == null ? null : Number(r.ts_end),
    }),
  }));
}

export function sourcesBlock(sources: RetrievedSource[]) {
  return sources
    .map((s) => `[S${s.n}] ${s.document_name}${s.location ? ` (${s.location})` : ""}${s.kind === "figure" ? " [figure description]" : ""}\n${s.content}`)
    .join("\n\n");
}

const LEVELS: Record<string, string> = {
  beginner: "Explain like a friendly tutor to a first-year student: plain words, short sentences, one concrete analogy.",
  intermediate: "Explain clearly for a student who knows the basics: precise terms, a short worked example when useful.",
  advanced: "Explain rigorously for an advanced student: formal terminology, edge cases and connections between concepts.",
};

export function tutorInstructions(level: string) {
  return `You are StudyLens, a tutor that answers ONLY from the student's uploaded course materials.
${LEVELS[level] ?? LEVELS.intermediate}

You receive numbered SOURCES ([S1], [S2], ...) retrieved from the student's library.
Rules:
1. Ground every claim in the sources and cite inline with the exact markers, e.g. "... [S2]". Only use marker numbers that appear in SOURCES. Never invent sources, page numbers or quotes.
2. If the sources do not contain enough information to answer, start your reply with exactly: "${REFUSAL}" and then briefly say what the materials do cover.
3. Format:
### From your materials
(the source-grounded explanation with citations)
Optionally, only if genuinely helpful:
### Outside knowledge (not from your materials)
(clearly general background, no citations, keep it short)
4. Be concise. Use markdown.`;
}
