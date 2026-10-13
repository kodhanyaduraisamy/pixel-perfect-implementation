import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";

import type { Database, Json } from "@/integrations/supabase/types";
import { AI_MODEL, createGateway, describeAiError, reasoningOptions } from "@/lib/ai/gateway.server";
import { withLovableAiGatewayRunIdHeader, getLovableAiGatewayRunId } from "@/lib/ai/run-id";
import { REFUSAL, retrieve, sourcesBlock, tutorInstructions } from "@/lib/rag.server";

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

function userClient(token: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const textOf = (m: UIMessage) =>
  m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ");

async function handle(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in.");
  const supabase = userClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return json(401, "Your session expired. Please sign in again.");
  const userId = auth.user.id;

  const body = (await request.json()) as { messages?: UIMessage[]; threadId?: string; level?: string; courseId?: string | null };
  const messages = body.messages ?? [];
  if (!body.threadId || !messages.length) return json(400, "Missing conversation.");
  const { data: thread } = await supabase.from("threads").select("id, title").eq("id", body.threadId).maybeSingle();
  if (!thread) return json(404, "Conversation not found.");

  const userTexts = messages.filter((m) => m.role === "user").map(textOf);
  const question = userTexts[userTexts.length - 1] ?? "";
  const retrievalQuery = userTexts.slice(-2).join(" ");

  let sources;
  try {
    sources = await retrieve(supabase, retrievalQuery, { courseId: body.courseId || null, k: 6 });
  } catch (e) {
    return json(500, e instanceof Error ? e.message : "Retrieval failed");
  }

  const persist = async (all: UIMessage[]) => {
    const rows = all.map((m) => ({
      user_id: userId,
      thread_id: thread.id,
      msg_id: m.id,
      role: m.role,
      parts: m.parts as unknown as Json,
    }));
    const { error } = await supabase.from("messages").upsert(rows, { onConflict: "thread_id,msg_id" });
    if (error) console.error("Failed to save messages", error);
    const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
    if (thread.title === "New conversation" && question) patch.title = question.slice(0, 60);
    await supabase.from("threads").update(patch).eq("id", thread.id);
  };

  const sourcePayload = sources.map((s) => ({
    n: s.n,
    chunk_id: s.chunk_id,
    document_id: s.document_id,
    document_name: s.document_name,
    location: s.location,
    page: s.page,
    kind: s.kind,
    excerpt: s.content.slice(0, 600),
  }));

  // Nothing retrieved: answer honestly without calling the model.
  if (!sources.length) {
    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: ({ writer }) => {
        writer.write({ type: "start" });
        writer.write({ type: "data-sources", data: [] });
        const id = "refusal";
        writer.write({ type: "text-start", id });
        writer.write({
          type: "text-delta",
          id,
          delta: `${REFUSAL}\n\nNo passage in your study library matched this question. Try rephrasing with terms from your notes, or upload material that covers it.`,
        });
        writer.write({ type: "text-end", id });
        writer.write({ type: "finish" });
      },
      onFinish: ({ messages: all }) => persist(all),
    });
    return createUIMessageStreamResponse({ stream });
  }

  let gateway;
  try {
    gateway = createGateway(getLovableAiGatewayRunId(request));
  } catch (e) {
    const err = describeAiError(e);
    return json(err.status, err.message);
  }

  const history = await convertToModelMessages(messages.slice(-10));
  const last = history[history.length - 1];
  const grounded = [
    ...history.slice(0, -1),
    { role: "user" as const, content: `SOURCES:\n${sourcesBlock(sources)}\n\nQUESTION: ${question}` },
  ];
  void last;

  const result = streamText({
    model: gateway.provider.responses(AI_MODEL),
    instructions: tutorInstructions(body.level ?? "intermediate"),
    messages: grounded,
    abortSignal: request.signal,
    providerOptions: reasoningOptions("low"),
  });

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-sources", data: sourcePayload });
      writer.merge(result.toUIMessageStream({ sendStart: false, sendReasoning: false }));
    },
    onError: (e) => describeAiError(e).message,
    onFinish: ({ messages: all }) => persist(all),
  });

  return withLovableAiGatewayRunIdHeader(createUIMessageStreamResponse({ stream }), gateway.runIdFetch);
}

export const Route = createFileRoute("/api/tutor")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
