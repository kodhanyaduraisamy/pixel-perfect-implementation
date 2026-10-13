import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Course = Tables<"courses">;
export type Doc = Tables<"documents">;
export type Topic = Tables<"topics">;
export type Mastery = Tables<"mastery">;
export type Quiz = Tables<"quizzes">;

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const useCourses = () =>
  useQuery({
    queryKey: ["courses"],
    queryFn: async () => unwrap(await supabase.from("courses").select("*").order("created_at")),
  });

export const useDocuments = () =>
  useQuery({
    queryKey: ["documents"],
    queryFn: async () => unwrap(await supabase.from("documents").select("*").order("created_at", { ascending: false })),
    refetchInterval: (q) => ((q.state.data as Doc[] | undefined)?.some((d) => !["ready", "failed"].includes(d.status)) ? 2500 : false),
  });

export interface TopicWithMastery extends Topic {
  p: number;
  attempts: number;
  correct: number;
  units: number;
}

export const useTopics = () =>
  useQuery({
    queryKey: ["topics"],
    queryFn: async (): Promise<TopicWithMastery[]> => {
      const [topics, mastery, chunks] = await Promise.all([
        supabase.from("topics").select("*").order("name"),
        supabase.from("mastery").select("*"),
        supabase.from("chunks").select("topic_id"),
      ]);
      const t = unwrap(topics);
      const m = new Map(unwrap(mastery).map((r) => [r.topic_id, r]));
      const counts = new Map<string, number>();
      for (const c of unwrap(chunks)) if (c.topic_id) counts.set(c.topic_id, (counts.get(c.topic_id) ?? 0) + 1);
      return t.map((x) => ({
        ...x,
        p: m.get(x.id)?.p_mastery ?? 0.3,
        attempts: m.get(x.id)?.attempts ?? 0,
        correct: m.get(x.id)?.correct ?? 0,
        units: counts.get(x.id) ?? 0,
      }));
    },
  });

export const useQuizzes = () =>
  useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => unwrap(await supabase.from("quizzes").select("*").order("created_at", { ascending: false })),
  });

export const useMasteryEvents = () =>
  useQuery({
    queryKey: ["mastery_events"],
    queryFn: async () => unwrap(await supabase.from("mastery_events").select("*").order("created_at")),
  });

export const useThreads = () =>
  useQuery({
    queryKey: ["threads"],
    queryFn: async () => unwrap(await supabase.from("threads").select("*").order("updated_at", { ascending: false })),
  });

export const useUser = () =>
  useQuery({
    queryKey: ["user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
