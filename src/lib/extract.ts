/**
 * Browser-side content extraction. Produces chunks with source metadata
 * (page / slide / timestamp). Nothing here fakes success: if a file yields no
 * text, the caller marks the document as failed.
 */
export type DocKind = "pdf" | "slides" | "transcript" | "notes" | "image";

export interface ExtractedChunk {
  content: string;
  kind: "text" | "figure" | "slide" | "transcript";
  page?: number | null;
  slide?: number | null;
  ts_start?: number | null;
  ts_end?: number | null;
}

export interface FigureCandidate {
  page: number | null;
  dataUrl: string;
}

export interface ExtractionResult {
  chunks: ExtractedChunk[];
  figures: FigureCandidate[];
  warnings: string[];
}

export function detectKind(file: File): DocKind | null {
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".pptx")) return "slides";
  if (n.endsWith(".vtt") || n.endsWith(".srt")) return "transcript";
  if (n.endsWith(".txt") || n.endsWith(".md")) return looksLikeTranscriptName(n) ? "transcript" : "notes";
  if (/\.(png|jpe?g|webp)$/.test(n)) return "image";
  return null;
}
const looksLikeTranscriptName = (n: string) => /transcript|lecture-video|captions/.test(n);

export const ACCEPTED = ".pdf,.pptx,.vtt,.srt,.txt,.md,.png,.jpg,.jpeg,.webp";

const MAX_CHARS = 1100;

function splitText(text: string): string[] {
  const clean = text.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + " " + p).length > MAX_CHARS && cur) {
      out.push(cur.trim());
      cur = p;
    } else cur = cur ? `${cur} ${p}` : p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((c) => c.length > 20);
}

async function extractPdf(file: File): Promise<ExtractionResult> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const chunks: ExtractedChunk[] = [];
  const figures: FigureCandidate[] = [];
  const warnings: string[] = [];
  const pages = Math.min(doc.numPages, 400);
  if (doc.numPages > 400) warnings.push(`Only the first 400 of ${doc.numPages} pages were indexed.`);
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("");
    for (const c of splitText(text)) chunks.push({ content: c, kind: "text", page: i });
    // Pages with almost no text are likely scans or diagrams — describe them visually.
    if (text.trim().length < 120 && figures.length < 8) {
      const viewport = page.getViewport({ scale: 1.3 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
      figures.push({ page: i, dataUrl: canvas.toDataURL("image/jpeg", 0.8) });
    }
  }
  return { chunks, figures, warnings };
}

async function extractPptx(file: File): Promise<ExtractionResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const chunks: ExtractedChunk[] = [];
  const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  for (const f of slideFiles) {
    const num = Number(f.match(/slide(\d+)/)![1]);
    const xml = await zip.files[f].async("string");
    const paragraphs = xml.split(/<\/a:p>/).map((p) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decode(m[1])).join(""));
    let text = paragraphs.filter(Boolean).join("\n");
    const notes = zip.files[`ppt/notesSlides/notesSlide${num}.xml`];
    if (notes) {
      const nx = await notes.async("string");
      const nt = [...nx.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decode(m[1])).join(" ").trim();
      if (nt && !/^\d+$/.test(nt)) text += `\nSpeaker notes: ${nt}`;
    }
    if (text.trim().length > 10) chunks.push({ content: text.trim(), kind: "slide", slide: num });
  }
  return { chunks, figures: [], warnings: [] };
}

function parseTime(t: string): number {
  const parts = t.replace(",", ".").split(":").map(Number);
  return parts.reduce((acc, v) => acc * 60 + v, 0);
}

export function parseTranscript(text: string): ExtractedChunk[] {
  const cues: { start: number; end: number | null; text: string }[] = [];
  const cueRe = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*((\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/;
  const lines = text.split(/\r?\n/);
  if (lines.some((l) => cueRe.test(l))) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/);
      if (!m) continue;
      const body: string[] = [];
      while (lines[i + 1] && lines[i + 1].trim() && !/^\d+$/.test(lines[i + 1].trim())) body.push(lines[++i].trim());
      cues.push({ start: parseTime(m[1]), end: parseTime(m[2]), text: body.join(" ").replace(/<[^>]+>/g, "") });
    }
  } else {
    // Plain transcripts with "[mm:ss]" or "hh:mm:ss" line prefixes.
    for (const l of lines) {
      const m = l.match(/^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*[-–:]?\s*(.+)$/);
      if (m) cues.push({ start: parseTime(m[1]), end: null, text: m[2].trim() });
      else if (cues.length && l.trim()) cues[cues.length - 1].text += " " + l.trim();
    }
  }
  const chunks: ExtractedChunk[] = [];
  let cur: { start: number; end: number | null; text: string } | null = null;
  for (const c of cues) {
    if (!cur) cur = { ...c };
    else if ((cur.text + " " + c.text).length > 700) {
      chunks.push({ content: cur.text, kind: "transcript", ts_start: cur.start, ts_end: cur.end ?? c.start });
      cur = { ...c };
    } else {
      cur.text += " " + c.text;
      cur.end = c.end ?? c.start;
    }
  }
  if (cur) chunks.push({ content: cur.text, kind: "transcript", ts_start: cur.start, ts_end: cur.end });
  return chunks.filter((c) => c.content.trim().length > 10);
}

async function fileToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export async function extractFile(file: File, kind: DocKind): Promise<ExtractionResult> {
  switch (kind) {
    case "pdf":
      return extractPdf(file);
    case "slides":
      return extractPptx(file);
    case "transcript": {
      const chunks = parseTranscript(await file.text());
      return {
        chunks,
        figures: [],
        warnings: chunks.length ? [] : ["No timestamps were found in this transcript."],
      };
    }
    case "notes":
      return { chunks: splitText(await file.text()).map((c) => ({ content: c, kind: "text" as const })), figures: [], warnings: [] };
    case "image":
      return { chunks: [], figures: [{ page: null, dataUrl: await fileToDataUrl(file) }], warnings: [] };
  }
}

export function formatTimestamp(sec: number | null | undefined) {
  if (sec == null) return "";
  const s = Math.floor(Number(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function formatLocation(c: { page?: number | null; slide?: number | null; ts_start?: number | null; ts_end?: number | null }) {
  if (c.page != null) return `p. ${c.page}`;
  if (c.slide != null) return `slide ${c.slide}`;
  if (c.ts_start != null) return `${formatTimestamp(c.ts_start)}${c.ts_end != null ? `–${formatTimestamp(c.ts_end)}` : ""}`;
  return "";
}
