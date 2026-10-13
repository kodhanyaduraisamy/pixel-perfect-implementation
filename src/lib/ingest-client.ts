import { supabase } from "@/integrations/supabase/client";
import { DEMO_COURSE_NAME, DEMO_DOCUMENTS } from "./demo-material";
import { detectKind, extractFile, type ExtractedChunk } from "./extract";
import { describeFigure, ingestDocument } from "./study.functions";

export type Stage = "uploading" | "extracting" | "describing" | "indexing" | "done" | "failed";
export interface UploadProgress {
  name: string;
  stage: Stage;
  pct: number;
  message?: string;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function processUpload(file: File, courseId: string, report: (p: UploadProgress) => void) {
  const name = file.name;
  const kind = detectKind(file);
  if (!kind) {
    report({ name, stage: "failed", pct: 100, message: "Unsupported file type. Use PDF, PPTX, VTT/SRT, TXT/MD or an image." });
    return;
  }
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");

  report({ name, stage: "uploading", pct: 5 });
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({ course_id: courseId, name, kind, mime: file.type || null, status: "uploading" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const fail = async (message: string) => {
    await supabase.from("documents").update({ status: "failed", error: message }).eq("id", doc.id);
    report({ name, stage: "failed", pct: 100, message });
  };

  const path = `${u.user.id}/${doc.id}/${name.replace(/[^\w.\-]+/g, "_")}`;
  const up = await supabase.storage.from("materials").upload(path, file, { contentType: file.type || undefined });
  if (up.error) return fail(`Upload failed: ${up.error.message}`);
  await supabase.from("documents").update({ status: "extracting", storage_path: path }).eq("id", doc.id);

  report({ name, stage: "extracting", pct: 30 });
  let chunks: ExtractedChunk[] = [];
  let warnings: string[] = [];
  try {
    const res = await extractFile(file, kind);
    chunks = res.chunks;
    warnings = res.warnings;
    if (res.figures.length) {
      await supabase.from("documents").update({ status: "describing" }).eq("id", doc.id);
      let i = 0;
      for (const fig of res.figures) {
        i++;
        report({ name, stage: "describing", pct: 40 + Math.round((i / res.figures.length) * 30), message: `Reading figure ${i}/${res.figures.length}` });
        try {
          const { description } = await describeFigure({
            data: { dataUrl: fig.dataUrl, context: `${name}${fig.page ? `, page ${fig.page}` : ""}` },
          });
          if (description) chunks.push({ content: description, kind: "figure", page: fig.page });
        } catch (e) {
          warnings.push(`Figure ${fig.page ? `on page ${fig.page} ` : ""}could not be described: ${msg(e)}`);
        }
      }
    }
  } catch (e) {
    return fail(`Text extraction failed: ${msg(e)}`);
  }
  if (!chunks.length) return fail(["No text or figures could be extracted from this file.", ...warnings].join(" "));

  report({ name, stage: "indexing", pct: 80, message: `Indexing ${chunks.length} content units & organising topics` });
  try {
    const r = await ingestDocument({ data: { documentId: doc.id, chunks, warnings } });
    report({ name, stage: r.status === "ready" ? "done" : "failed", pct: 100, message: `${r.units} content units indexed` });
  } catch (e) {
    return fail(`Indexing failed: ${msg(e)}`);
  }
}

export async function loadDemoCourse(report: (p: UploadProgress) => void) {
  const { data: existing } = await supabase.from("courses").select("id").eq("name", DEMO_COURSE_NAME).maybeSingle();
  let courseId = existing?.id;
  if (!courseId) {
    const { data, error } = await supabase.from("courses").insert({ name: DEMO_COURSE_NAME, is_demo: true }).select("id").single();
    if (error) throw new Error(error.message);
    courseId = data.id;
  }
  for (const d of DEMO_DOCUMENTS) {
    const { data: dup } = await supabase.from("documents").select("id").eq("course_id", courseId).eq("name", d.name).maybeSingle();
    if (dup) continue;
    report({ name: d.name, stage: "indexing", pct: 50, message: "Indexing demo material" });
    const { data: doc, error } = await supabase
      .from("documents")
      .insert({ course_id: courseId, name: d.name, kind: d.kind, status: "extracting", is_demo: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    try {
      await ingestDocument({ data: { documentId: doc.id, chunks: d.chunks, warnings: [] } });
      report({ name: d.name, stage: "done", pct: 100, message: `${d.chunks.length} content units indexed` });
    } catch (e) {
      await supabase.from("documents").update({ status: "failed", error: msg(e) }).eq("id", doc.id);
      report({ name: d.name, stage: "failed", pct: 100, message: msg(e) });
    }
  }
  return courseId;
}
