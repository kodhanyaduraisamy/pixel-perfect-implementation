import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRIOR_MASTERY, adaptiveDifficulty, updateMastery, type Difficulty } from "./mastery";

const chunkSchema = z.object({
  content: z.string().min(1).max(20000),
  kind: z.enum(["text", "figure", "slide", "transcript"]),
  page: z.number().int().nullable().optional(),
  slide: z.number().int().nullable().optional(),
  ts_start: z.number().nullable().optional(),
  ts_end: z.number().nullable().optional(),
});

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */
export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isAiConfigured, AI_MODEL } = await import("./ai/gateway.server");
  return { configured: isAiConfigured(), model: AI_MODEL };
});

/* ------------------------------------------------------------------ */
/* Figures / diagrams (multimodal)                                     */
/* ------------------------------------------------------------------ */
export const describeFigure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ dataUrl: z.string().startsWith("data:image/").max(6_000_000), context: z.string().max(300) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { generatePlainText } = await import("./ai/gateway.server");
    const text = await generatePlainText({
      instructions:
        "You convert course-material images (scanned pages, diagrams, charts, slides) into study text. First transcribe any legible text verbatim. Then describe each diagram or figure: what it shows, labels, arrows and relationships. Do not add facts that are not visible. If the image is blank or illegible, reply exactly: NO_CONTENT",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Source: ${data.context}` },
            { type: "image", image: new URL(data.dataUrl) },
          ],
        },
      ],
    });
    const clean = text.trim();
    return { description: clean === "NO_CONTENT" ? null : clean };
  });

/* ------------------------------------------------------------------ */
/* Ingestion: store chunks + organise into topics                      */
/* ------------------------------------------------------------------ */
export const ingestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({ documentId: z.string().uuid(), chunks: z.array(chunkSchema).max(3000), warnings: z.array(z.string()).max(20) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc, error: docErr } = await supabase.from("documents").select("*").eq("id", data.documentId).single();
    if (docErr || !doc) throw new Error("Document not found");

    if (!data.chunks.length) {
      await supabase
        .from("documents")
        .update({ status: "failed", error: ["No text or figures could be extracted from this file.", ...data.warnings].join(" ") })
        .eq("id", doc.id);
      return { status: "failed" as const, units: 0 };
    }

    await supabase.from("chunks").delete().eq("document_id", doc.id);
    const rows = data.chunks.map((c, i) => ({
      user_id: userId,
      document_id: doc.id,
      course_id: doc.course_id,
      seq: i,
      kind: c.kind,
      content: c.content,
      page: c.page ?? null,
      slide: c.slide ?? null,
      ts_start: c.ts_start ?? null,
      ts_end: c.ts_end ?? null,
    }));
    const ids: string[] = [];
    for (let i = 0; i < rows.length; i += 200) {
      const { data: ins, error } = await supabase.from("chunks").insert(rows.slice(i, i + 200)).select("id, seq");
      if (error) {
        await supabase.from("documents").update({ status: "failed", error: `Indexing failed: ${error.message}` }).eq("id", doc.id);
        throw new Error(`Indexing failed: ${error.message}`);
      }
      for (const r of ins.sort((a, b) => a.seq - b.seq)) ids[r.seq] = r.id;
    }
    const figureCount = data.chunks.filter((c) => c.kind === "figure").length;
    await supabase
      .from("documents")
      .update({ status: "organizing", unit_count: rows.length, figure_count: figureCount })
      .eq("id", doc.id);

    // Topic organisation
    const notes = [...data.warnings];
    let summary: string | null = null;
    try {
      const { generateStructured } = await import("./ai/gateway.server");
      const { data: existing } = await supabase.from("topics").select("id, name").eq("course_id", doc.course_id);
      const listing = data.chunks.map((c, i) => `#${i}: ${c.content.slice(0, 260).replace(/\s+/g, " ")}`).join("\n");
      const result = await generateStructured({
        schema: z.object({
          summary: z.string(),
          topics: z.array(
            z.object({
              name: z.string(),
              description: z.string(),
              parent: z.string().nullable(),
              prerequisites: z.array(z.string()),
              chunks: z.array(z.number()),
            }),
          ),
        }),
        instructions:
          "You organise course material into a topic map. Use 3-10 concise topic names (2-4 words, Title Case). Reuse an existing course topic name exactly when it fits. A topic may have a parent topic (subtopic relation) and prerequisite concepts (names of other topics). Assign every chunk number to exactly one topic. Summary: 1-2 sentences describing the document. Base everything only on the chunks.",
        content: `Existing course topics: ${(existing ?? []).map((t) => t.name).join(", ") || "(none)"}\nDocument: ${doc.name}\n\nChunks:\n${listing.slice(0, 120_000)}`,
      });
      summary = result.summary;
      const topicNames = result.topics.map((t) => t.name.trim()).filter(Boolean);
      if (topicNames.length) {
        const { data: upserted, error: tErr } = await supabase
          .from("topics")
          .upsert(
            result.topics.map((t) => ({
              user_id: userId,
              course_id: doc.course_id,
              name: t.name.trim(),
              description: t.description,
              prerequisites: t.prerequisites,
            })),
            { onConflict: "course_id,name" },
          )
          .select("id, name");
        if (tErr) throw new Error(tErr.message);
        const byName = new Map(upserted.map((t) => [t.name, t.id]));
        for (const t of result.topics) {
          const id = byName.get(t.name.trim());
          if (!id) continue;
          const parentId = t.parent ? byName.get(t.parent.trim()) ?? (existing ?? []).find((e) => e.name === t.parent)?.id : null;
          if (parentId && parentId !== id) await supabase.from("topics").update({ parent_id: parentId }).eq("id", id);
          const chunkIds = t.chunks.map((n) => ids[n]).filter(Boolean);
          if (chunkIds.length) await supabase.from("chunks").update({ topic_id: id }).in("id", chunkIds);
        }
      }
    } catch (e) {
      notes.push(`Topic organisation failed (${e instanceof Error ? e.message : "unknown error"}); content is still searchable.`);
    }

    await supabase
      .from("documents")
      .update({ status: "ready", summary, error: notes.length ? notes.join(" ") : null })
      .eq("id", doc.id);
    return { status: "ready" as const, units: rows.length };
  });

/* ------------------------------------------------------------------ */
/* Quiz generation with answer-key verification                        */
/* ------------------------------------------------------------------ */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        courseId: z.string().uuid(),
        topicId: z.string().uuid().nullable(),
        count: z.number().int().min(1).max(10),
        difficulty: z.enum(["easy", "medium", "hard", "adaptive"]),
        diagnostic: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { generateStructured } = await import("./ai/gateway.server");

    // Resolve difficulty
    let difficulty: Difficulty = data.difficulty === "adaptive" ? "easy" : data.difficulty;
    if (data.difficulty === "adaptive" && data.topicId) {
      const { data: m } = await supabase.from("mastery").select("*").eq("topic_id", data.topicId).maybeSingle();
      difficulty = adaptiveDifficulty(m?.p_mastery ?? PRIOR_MASTERY, m?.attempts ?? 0);
    } else if (data.difficulty === "adaptive") {
      const { data: ms } = await supabase.from("mastery").select("p_mastery, attempts, topics!inner(course_id)").eq("topics.course_id", data.courseId);
      const avg = ms?.length ? ms.reduce((s, m) => s + m.p_mastery, 0) / ms.length : PRIOR_MASTERY;
      difficulty = adaptiveDifficulty(avg, ms?.length ?? 0);
    }
    if (data.diagnostic) difficulty = "medium";

    // 1. Reuse verified questions the learner has never attempted.
    const { data: attempted } = await supabase.from("attempts").select("question_id");
    const seen = new Set((attempted ?? []).map((a) => a.question_id));
    let reuseQ = supabase.from("questions").select("id, chunk_id").eq("course_id", data.courseId).eq("difficulty", difficulty).eq("verified", true);
    if (data.topicId) reuseQ = reuseQ.eq("topic_id", data.topicId);
    const { data: bank } = await reuseQ;
    const reusable = shuffle((bank ?? []).filter((q) => !seen.has(q.id))).slice(0, data.count);
    const chosen = reusable.map((q) => q.id);
    const usedChunks = new Set((bank ?? []).map((q) => q.chunk_id));

    // 2. Generate the rest from retrieved course content.
    let discarded = 0;
    let unverifiedKept = 0;
    const need = data.count - chosen.length;
    if (need > 0) {
      let cq = supabase.from("chunks").select("id, content, page, slide, ts_start, topic_id, documents!inner(name, status)").eq("course_id", data.courseId).eq("documents.status", "ready");
      if (data.topicId) cq = cq.eq("topic_id", data.topicId);
      const { data: chunks, error } = await cq.limit(500);
      if (error) throw new Error(error.message);
      const usable = (chunks ?? []).filter((c) => c.content.length > 120);
      if (!usable.length) throw new Error("There is no indexed content for this selection yet. Upload material first.");

      let picked: typeof usable;
      if (data.diagnostic) {
        const byTopic = new Map<string, typeof usable>();
        for (const c of shuffle(usable)) {
          const k = c.topic_id ?? "none";
          byTopic.set(k, [...(byTopic.get(k) ?? []), c]);
        }
        picked = [];
        while (picked.length < need + 2 && [...byTopic.values()].some((v) => v.length)) {
          for (const v of byTopic.values()) if (v.length && picked.length < need + 2) picked.push(v.shift()!);
        }
      } else {
        const fresh = shuffle(usable.filter((c) => !usedChunks.has(c.id)));
        picked = [...fresh, ...shuffle(usable.filter((c) => usedChunks.has(c.id)))].slice(0, need + 2);
      }

      const passages = picked.map((c, i) => `[C${i + 1}] (${c.documents.name})\n${c.content}`).join("\n\n");
      const gen = await generateStructured({
        effort: "medium",
        schema: z.object({
          questions: z.array(
            z.object({
              passage: z.number(),
              stem: z.string(),
              options: z.array(z.string()),
              correct_index: z.number(),
              explanation: z.string(),
              evidence_quote: z.string(),
              misconception: z.string(),
            }),
          ),
        }),
        instructions: `You write ${difficulty} multiple-choice questions strictly from the given passages.
- Write one question per passage (up to ${picked.length}), using passage numbers C1..C${picked.length}.
- Exactly 4 options, one unambiguously correct according to the passage. Distractors should reflect plausible misconceptions.
- easy = recall a stated fact; medium = understand/explain; hard = apply or compare.
- evidence_quote: copy a short sentence VERBATIM from the passage that proves the answer.
- explanation: why the correct answer is right, grounded in the passage.
- misconception: the misconception the most tempting distractor represents.`,
        content: passages,
      });

      const candidates = gen.questions
        .filter((q) => q.options.length === 4 && q.correct_index >= 0 && q.correct_index < 4 && picked[q.passage - 1])
        .map((q) => ({ ...q, chunk: picked[q.passage - 1] }));

      // Verification step 1: the quoted evidence must really exist in the passage.
      const quoted = candidates.filter((q) => {
        const ok = norm(q.evidence_quote).length > 10 && norm(q.chunk.content).includes(norm(q.evidence_quote));
        if (!ok) discarded++;
        return ok;
      });

      // Verification step 2: an independent solver must reach the same answer from the passage alone.
      let solverOk = true;
      let solved: { q: number; choice: number }[] = [];
      try {
        const s = await generateStructured({
          schema: z.object({ answers: z.array(z.object({ q: z.number(), choice: z.number() })) }),
          instructions:
            "For each question, read ONLY its passage and pick the option index (0-3) the passage supports. If no option is supported, use -1.",
          content: quoted
            .map((q, i) => `Q${i + 1}\nPassage: ${q.chunk.content}\nQuestion: ${q.stem}\n${q.options.map((o, j) => `${j}) ${o}`).join("\n")}`)
            .join("\n\n"),
        });
        solved = s.answers;
      } catch {
        solverOk = false;
      }

      const inserts = [];
      for (let i = 0; i < quoted.length && inserts.length < need; i++) {
        const q = quoted[i];
        const solverChoice = solved.find((a) => a.q === i + 1)?.choice;
        const verified = solverOk && solverChoice === q.correct_index;
        if (solverOk && !verified) {
          discarded++;
          continue;
        }
        if (!solverOk) unverifiedKept++;
        inserts.push({
          user_id: userId,
          course_id: data.courseId,
          topic_id: q.chunk.topic_id,
          chunk_id: q.chunk.id,
          difficulty,
          stem: q.stem,
          options: q.options,
          correct_index: q.correct_index,
          explanation: `${q.explanation}${q.misconception ? `\n\nCommon misconception: ${q.misconception}` : ""}`,
          evidence: q.evidence_quote,
          verified,
          verification_note: verified
            ? "Evidence quote found in source and independent solver agreed with the answer key."
            : "Verification could not run (verifier unavailable). Evidence quote was found in the source.",
        });
      }
      if (inserts.length) {
        const { data: ins, error: insErr } = await supabase.from("questions").insert(inserts).select("id");
        if (insErr) throw new Error(insErr.message);
        chosen.push(...ins.map((q) => q.id));
      }
    }

    if (!chosen.length) throw new Error("No question passed verification. Try another topic or upload more material.");

    const noteParts = [
      reusable.length ? `${reusable.length} reused from your question bank (never attempted).` : "",
      chosen.length - reusable.length ? `${chosen.length - reusable.length} newly generated.` : "",
      discarded ? `${discarded} discarded after failing answer-key verification.` : "",
      unverifiedKept ? `${unverifiedKept} could not be verified and are marked as unverified.` : "",
      chosen.length < data.count ? `Only ${chosen.length} of ${data.count} requested questions could be produced.` : "",
    ].filter(Boolean);

    const { data: quiz, error: qErr } = await supabase
      .from("quizzes")
      .insert({
        user_id: userId,
        course_id: data.courseId,
        topic_id: data.topicId,
        difficulty,
        is_diagnostic: data.diagnostic,
        question_ids: chosen,
        total: chosen.length,
        generation_note: noteParts.join(" "),
      })
      .select("id")
      .single();
    if (qErr) throw new Error(qErr.message);
    return { quizId: quiz.id };
  });

export const answerQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ quizId: z.string().uuid(), questionId: z.string().uuid(), selected: z.number().int().min(0).max(3) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: q, error } = await supabase.from("questions").select("*").eq("id", data.questionId).single();
    if (error || !q) throw new Error("Question not found");
    const correct = data.selected === q.correct_index;

    const { error: aErr } = await supabase
      .from("attempts")
      .insert({ user_id: userId, quiz_id: data.quizId, question_id: q.id, selected_index: data.selected, correct });
    if (aErr) {
      if (aErr.code === "23505") throw new Error("You already answered this question.");
      throw new Error(aErr.message);
    }

    let mastery: { before: number; after: number } | null = null;
    if (q.topic_id) {
      const { data: m } = await supabase.from("mastery").select("*").eq("topic_id", q.topic_id).maybeSingle();
      const before = m?.p_mastery ?? PRIOR_MASTERY;
      const after = updateMastery(before, correct, q.difficulty as Difficulty);
      await supabase.from("mastery").upsert({
        user_id: userId,
        topic_id: q.topic_id,
        p_mastery: after,
        attempts: (m?.attempts ?? 0) + 1,
        correct: (m?.correct ?? 0) + (correct ? 1 : 0),
        updated_at: new Date().toISOString(),
      });
      await supabase
        .from("mastery_events")
        .insert({ user_id: userId, topic_id: q.topic_id, p_before: before, p_after: after, correct, difficulty: q.difficulty });
      mastery = { before, after };
    }
    return { correct, correctIndex: q.correct_index, explanation: q.explanation, evidence: q.evidence, mastery };
  });

export const finishQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ quizId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: at } = await supabase.from("attempts").select("correct").eq("quiz_id", data.quizId);
    const score = (at ?? []).filter((a) => a.correct).length;
    await supabase.from("quizzes").update({ score, completed_at: new Date().toISOString() }).eq("id", data.quizId);
    return { score };
  });

/* ------------------------------------------------------------------ */
/* RAG evaluation (one item per call, LLM-as-judge metrics)            */
/* ------------------------------------------------------------------ */
export const evaluateRagItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        question: z.string().max(500),
        reference: z.string().max(1000).nullable(),
        answerable: z.boolean(),
        courseId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { retrieve, sourcesBlock, tutorInstructions, REFUSAL } = await import("./rag.server");
    const { generatePlainText, generateStructured } = await import("./ai/gateway.server");
    const sources = await retrieve(context.supabase, data.question, { courseId: data.courseId, k: 6 });
    let answer = REFUSAL;
    if (sources.length) {
      answer = await generatePlainText({
        instructions: tutorInstructions("intermediate"),
        messages: [{ role: "user", content: `SOURCES:\n${sourcesBlock(sources)}\n\nQUESTION: ${data.question}` }],
      });
    }
    const refused = answer.includes(REFUSAL);
    let metrics: { faithfulness: number; answer_relevancy: number; context_precision: number | null; context_recall: number | null } | null = null;
    let judgeNote: string | null = null;
    if (sources.length && !refused) {
      const j = await generateStructured({
        schema: z.object({
          faithfulness: z.number(),
          answer_relevancy: z.number(),
          context_precision: z.number(),
          context_recall: z.number().nullable(),
          note: z.string(),
        }),
        instructions: `You are a strict RAG evaluator. Score each metric from 0 to 1.
faithfulness: fraction of claims in the "From your materials" part of the ANSWER that are supported by CONTEXT.
answer_relevancy: how directly the ANSWER addresses the QUESTION.
context_precision: fraction of CONTEXT passages that are relevant to the QUESTION, weighting higher-ranked passages more.
context_recall: fraction of facts in REFERENCE that appear in CONTEXT; null if REFERENCE is "none".
note: one short sentence.`,
        content: `QUESTION: ${data.question}\nREFERENCE: ${data.reference ?? "none"}\n\nCONTEXT:\n${sourcesBlock(sources)}\n\nANSWER:\n${answer}`,
      });
      const c = (v: number | null) => (v == null ? null : Math.max(0, Math.min(1, v)));
      metrics = {
        faithfulness: c(j.faithfulness)!,
        answer_relevancy: c(j.answer_relevancy)!,
        context_precision: c(j.context_precision),
        context_recall: data.answerable ? c(j.context_recall) : null,
      };
      judgeNote = j.note;
    }
    return {
      answer,
      refused,
      retrieved: sources.length,
      correctBehaviour: data.answerable ? !refused : refused,
      metrics,
      judgeNote,
    };
  });
