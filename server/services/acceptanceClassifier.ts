/**
 * Acceptance Classifier
 *
 * Tiebreaker for ambiguous user replies like "ok", "yeah", "sure" — words
 * that *might* mean "yes, hand me that resource" or might just be social
 * acknowledgement ("yeah, things are rough"). Strict-match phrases bypass
 * this entirely; this only runs when:
 *   1. The reply matched AMBIGUOUS_AFFIRMATIVE in sianiTurn, AND
 *   2. Siani's previous turn named a known resource.
 *
 * Uses GPT-5 with `reasoning_effort: "minimal"` because (a) GPT-5 burns the
 * whole token budget on reasoning otherwise (returns empty), and (b) this
 * is a one-shot binary classification — no chain-of-thought needed.
 */

import { getOpenAIClient, isOpenAIConfigured } from "../integrations/openai";
import { logError } from "../lib/logger";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

/**
 * GPT-5 introduces `reasoning_effort` which is not yet in every published
 * @types/openai version. Extend the SDK params shape locally rather than
 * reaching for `as any` — keeps the rest of the call site fully typed.
 */
type Gpt5ChatParams = ChatCompletionCreateParamsNonStreaming & {
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
};

export interface AcceptanceContext {
  userMessage: string;
  lastAssistantMessage: string;
  offeredResourceName: string;
}

const CLASSIFIER_PROMPT = `You decide if a short user reply means "YES, please give me that resource the assistant just offered" or NOT.

Output ONLY one token: YES or NO. No punctuation, no explanation.

Treat as YES: explicit acceptance of the specific offer (e.g. "yeah send it", "ok do that", "alright give me the number").
Treat as NO: pure social acknowledgement ("yeah it's been rough"), continuing the previous topic, asking another question, or vague filler that doesn't actually accept the offer.`;

export async function classifyAcceptance(
  ctx: AcceptanceContext
): Promise<boolean> {
  // Without an OpenAI key we conservatively fall through as NOT-accepted —
  // the strict-affirmative regex still catches the obvious cases.
  if (!isOpenAIConfigured()) return false;

  try {
    const openai = getOpenAIClient();
    const params: Gpt5ChatParams = {
      model: "gpt-5",
      reasoning_effort: "minimal",
      max_completion_tokens: 8,
      messages: [
        { role: "system", content: CLASSIFIER_PROMPT },
        {
          role: "user",
          content: [
            `Assistant just offered: "${truncate(ctx.lastAssistantMessage, 280)}"`,
            `Resource named: ${ctx.offeredResourceName}`,
            `User reply: "${truncate(ctx.userMessage, 160)}"`,
          ].join("\n"),
        },
      ],
    };
    const resp = await openai.chat.completions.create(params);

    const raw = resp.choices?.[0]?.message?.content?.trim().toUpperCase() || "";
    return raw.startsWith("YES");
  } catch (err) {
    // Failing closed (NO) keeps us from creating ghost referrals when the
    // model is unreachable. Strict-match path still works.
    logError("acceptanceClassifier.gpt5", err, { nonBlocking: true });
    return false;
  }
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
