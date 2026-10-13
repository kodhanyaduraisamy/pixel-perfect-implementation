import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BookMarked, ExternalLink, Globe2, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { LogoMark } from "@/components/study/Logo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCourses, useThreads } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tutor/$threadId")({
  head: () => ({ meta: [{ title: "AI Tutor · StudyLens AI" }, { name: "description", content: "Ask questions answered from your own materials." }] }),
  component: TutorPage,
});

interface SourceInfo {
  n: number;
  chunk_id: string;
  document_id: string;
  document_name: string;
  location: string;
  kind: string;
  excerpt: string;
}

const SUGGESTED = [
  "Summarise the key ideas of this course",
  "Explain the hardest concept in my notes step by step",
  "What are the prerequisites I should review first?",
  "Compare two related concepts from my materials",
];

function TutorPage() {
  const { threadId } = Route.useParams();
  const { data: threads = [] } = useThreads();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const newThread = async () => {
    const { data, error } = await supabase.from("threads").insert({}).select("id").single();
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/tutor/$threadId", params: { threadId: data.id } });
  };
  const deleteThread = async (id: string) => {
    await supabase.from("threads").delete().eq("id", id);
    await qc.invalidateQueries({ queryKey: ["threads"] });
    if (id === threadId) navigate({ to: "/tutor" });
  };

  const { data: initial, isLoading } = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("thread_id", threadId).order("created_at").order("id");
      if (error) throw new Error(error.message);
      return (data ?? []).map((m) => ({ id: m.msg_id, role: m.role as UIMessage["role"], parts: m.parts as UIMessage["parts"] }));
    },
    staleTime: Infinity,
  });

  return (
    <div className="-my-6 flex h-[calc(100vh-4rem)] gap-6 md:-my-10 lg:h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r py-6 pr-4 md:flex">
        <Button onClick={newThread} className="mb-4"><Plus /> New conversation</Button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {threads.map((t) => (
            <div key={t.id} className={cn("group flex items-center rounded-lg", t.id === threadId ? "bg-accent" : "hover:bg-muted")}>
              <Link to="/tutor/$threadId" params={{ threadId: t.id }} className="min-w-0 flex-1 truncate px-3 py-2 text-sm">
                {t.title}
              </Link>
              <button onClick={() => deleteThread(t.id)} className="mr-1 hidden rounded p-1 text-muted-foreground hover:text-destructive group-hover:block" aria-label="Delete conversation">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col py-6">
        {isLoading || !initial ? (
          <p className="text-sm text-muted-foreground">Loading conversation…</p>
        ) : (
          <ChatWindow key={threadId} threadId={threadId} initial={initial} onNew={newThread} />
        )}
      </div>
    </div>
  );
}

function linkCitations(text: string, sources: SourceInfo[]) {
  return text.replace(/\[S(\d+)\]/g, (m, n) => {
    const s = sources.find((x) => x.n === Number(n));
    if (!s) return "*(unverified citation removed)*";
    return `[[S${n}]](/library/${s.document_id}?chunk=${s.chunk_id})`;
  });
}

function AssistantBody({ message, streaming }: { message: UIMessage; streaming: boolean }) {
  const sourcesPart = message.parts.find((p) => p.type === "data-sources") as { data: SourceInfo[] } | undefined;
  const sources = sourcesPart?.data ?? [];
  const text = message.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("");
  const cited = new Set([...text.matchAll(/\[S(\d+)\]/g)].map((m) => Number(m[1])));
  const outsideIdx = text.search(/#+\s*Outside knowledge/i);
  const grounded = outsideIdx >= 0 ? text.slice(0, outsideIdx) : text;
  const outside = outsideIdx >= 0 ? text.slice(outsideIdx).replace(/^#+\s*Outside knowledge[^\n]*\n?/i, "") : "";
  const citedSources = sources.filter((s) => cited.has(s.n));
  const other = sources.filter((s) => !cited.has(s.n));

  return (
    <div className="space-y-4">
      {!text && streaming && <Shimmer>Searching your materials…</Shimmer>}
      {grounded && (
        <div className="flex gap-2.5">
          <ShieldCheck className="mt-1 size-4 shrink-0 text-primary" />
          <MessageResponse>{linkCitations(grounded, sources)}</MessageResponse>
        </div>
      )}
      {outside && (
        <div className="rounded-xl border border-warning/50 bg-warning/10 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warning-foreground">
            <Globe2 className="size-3.5" /> Outside knowledge — not from your materials
          </p>
          <MessageResponse>{outside}</MessageResponse>
        </div>
      )}
      {!streaming && citedSources.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cited sources</p>
          {citedSources.map((s) => <SourceCard key={s.chunk_id} s={s} />)}
        </div>
      )}
      {!streaming && other.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">{other.length} other retrieved passages (not cited)</summary>
          <div className="mt-2 space-y-2">{other.map((s) => <SourceCard key={s.chunk_id} s={s} />)}</div>
        </details>
      )}
    </div>
  );
}

function SourceCard({ s }: { s: SourceInfo }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-foreground">S{s.n}</span>
        <BookMarked className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 truncate text-sm font-medium">{s.document_name}</span>
        {s.location && <span className="font-mono text-xs text-muted-foreground">{s.location}</span>}
        {s.kind === "figure" && <span className="text-[11px] text-accent-foreground">figure</span>}
        <Link to="/library/$docId" params={{ docId: s.document_id }} search={{ chunk: s.chunk_id }} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Open source <ExternalLink className="size-3" />
        </Link>
      </div>
      <p className="mt-2 line-clamp-4 border-l-2 border-primary/40 pl-3 text-xs leading-relaxed text-muted-foreground">“{s.excerpt}”</p>
    </div>
  );
}

function ChatWindow({ threadId, initial, onNew }: { threadId: string; initial: UIMessage[]; onNew: () => void }) {
  const qc = useQueryClient();
  const { data: courses = [] } = useCourses();
  const [level, setLevel] = useState(() => (typeof window !== "undefined" && localStorage.getItem("sl-level")) || "intermediate");
  const [courseId, setCourseId] = useState<string>("all");
  const [input, setInput] = useState("");
  const ref = useRef({ level, courseId });
  ref.current = { level, courseId };
  const taRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/tutor",
        prepareSendMessagesRequest: async ({ messages, id }) => {
          const { data } = await supabase.auth.getSession();
          return {
            headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
            body: { messages, threadId: id, level: ref.current.level, courseId: ref.current.courseId === "all" ? null : ref.current.courseId },
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => {
      let m = e.message;
      try { m = JSON.parse(m).error ?? m; } catch { /* plain text */ }
      toast.error(m);
    },
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["thread-messages", threadId] });
      taRef.current?.focus();
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { taRef.current?.focus(); }, []);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
    taRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <LogoMark className="size-8" />
          <div>
            <p className="text-sm font-semibold">StudyLens Tutor</p>
            <p className="text-xs text-muted-foreground">Answers only from your library, with citations</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="h-8 w-48 bg-card text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex rounded-lg border bg-card p-0.5">
            {["beginner", "intermediate", "advanced"].map((l) => (
              <button
                key={l}
                onClick={() => { setLevel(l); localStorage.setItem("sl-level", l); }}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", level === l ? "bg-navy text-navy-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {l}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="md:hidden" onClick={onNew}><Plus /> New</Button>
        </div>
      </div>

      <Conversation className="surface min-h-0 flex-1 rounded-2xl border">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<LogoMark />}
              title="Ask anything about your materials"
              description="Answers are grounded in retrieved passages and cite the page, slide or timestamp."
            >
              <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTED.map((q) => (
                  <button key={q} onClick={() => send(q)} className="rounded-xl border bg-card p-3 text-left text-sm hover:border-primary hover:bg-accent">
                    {q}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m, i) => (
              <Message key={m.id} from={m.role}>
                <MessageContent className={m.role === "user" ? "bg-navy text-navy-foreground" : ""}>
                  {m.role === "user" ? (
                    m.parts.map((p, j) => (p.type === "text" ? <span key={j} className="whitespace-pre-wrap">{p.text}</span> : null))
                  ) : (
                    <AssistantBody message={m} streaming={busy && i === messages.length - 1} />
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && messages[messages.length - 1]?.role === "user" && (
            <Message from="assistant"><MessageContent><Shimmer>Retrieving passages from your library…</Shimmer></MessageContent></Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput onSubmit={(m) => send(m.text)} className="mt-3 bg-card">
        <PromptInputBody>
          <PromptInputTextarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question about your course material…" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <span className="px-2 text-xs capitalize text-muted-foreground">{level} explanations</span>
          </PromptInputTools>
          <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
