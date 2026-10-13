import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/tutor/")({
  beforeLoad: async () => {
    const { data } = await supabase.from("threads").select("id").order("updated_at", { ascending: false }).limit(1);
    let id = data?.[0]?.id;
    if (!id) {
      const { data: created, error } = await supabase.from("threads").insert({}).select("id").single();
      if (error) throw new Error(error.message);
      id = created.id;
    }
    throw redirect({ to: "/tutor/$threadId", params: { threadId: id }, replace: true });
  },
});
