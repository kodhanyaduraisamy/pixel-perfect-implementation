import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import type { z } from "zod";

import { createLovableAiGatewayRunIdFetch } from "./run-id";

export const AI_MODEL = "openai/gpt-6-astra";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

export class AiUnavailableError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function isAiConfigured() {
  return Boolean(process.env.LOVABLE_API_KEY);
}

/** Creates a request-scoped provider. Never call at module scope. */
export function createGateway(initialRunId?: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    throw new AiUnavailableError(
      "AI is not configured for this app yet (missing AI key). Uploading and browsing still work.",
      503,
    );
  }
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return { provider, runIdFetch };
}

export const reasoningOptions = (effort: "low" | "medium" = "low") => ({
  openai: {
    forceReasoning: true,
    reasoningEffort: effort,
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
});

/** Turns gateway failures into clear, user-facing messages. */
export function describeAiError(error: unknown): AiUnavailableError {
  if (error instanceof AiUnavailableError) return error;
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  if (status === 402)
    return new AiUnavailableError("AI credits are exhausted. Add credits in Settings → Plans & credits.", 402);
  if (status === 429) return new AiUnavailableError("The AI is rate limited right now. Please wait a moment and retry.", 429);
  if (status === 403) return new AiUnavailableError("AI access was denied for this workspace.", 403);
  if (NoObjectGeneratedError.isInstance(error))
    return new AiUnavailableError("The AI returned an incomplete result. Please try again.", 502);
  const message = error instanceof Error ? error.message : String(error);
  return new AiUnavailableError(`AI request failed: ${message}`, status ?? 500);
}

/** Streams a structured-output call and returns the parsed object. */
export async function generateStructured<S extends z.ZodTypeAny>(opts: {
  schema: S;
  instructions: string;
  content: ModelMessage["content"];
  effort?: "low" | "medium";
}): Promise<z.infer<S>> {
  const { provider } = createGateway();
  try {
    const result = streamText({
      model: provider.responses(AI_MODEL),
      instructions: opts.instructions,
      messages: [{ role: "user", content: opts.content } as ModelMessage],
      output: Output.object({ schema: opts.schema }),
      providerOptions: reasoningOptions(opts.effort ?? "low"),
    });
    return (await result.output) as z.infer<S>;
  } catch (error) {
    throw describeAiError(error);
  }
}

/** Streams a plain-text call and returns the final text. */
export async function generatePlainText(opts: {
  instructions: string;
  messages: ModelMessage[];
  effort?: "low" | "medium";
}) {
  const { provider } = createGateway();
  try {
    const result = streamText({
      model: provider.responses(AI_MODEL),
      instructions: opts.instructions,
      messages: opts.messages,
      providerOptions: reasoningOptions(opts.effort ?? "low"),
    });
    return await result.text;
  } catch (error) {
    throw describeAiError(error);
  }
}
