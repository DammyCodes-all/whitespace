import { NextResponse } from "next/server";
import { answerChatbot } from "@/lib/agent/chatbot";
import { LlmError } from "@/lib/agent/llm-client";
import type { WorkType } from "@/lib/types";

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/**
 * Day 9 U: POST { pitchText, workType } -> ChatbotResult.
 * Thin wrapper over the server-only plain answer call; the browser never
 * sees keys. Ungrounded by design (§6.11) — the marks come from Qloo
 * in the caller's `markChatbotTitles`, not from here.
 */
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const root =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const pitchText = typeof root.pitchText === "string" ? root.pitchText : "";
  const workType = typeof root.workType === "string" ? root.workType : "";
  if (pitchText.trim() === "") {
    return NextResponse.json(
      { error: "pitchText is required." },
      { status: 400 },
    );
  }
  if (!WORK_TYPES.includes(workType as WorkType)) {
    return NextResponse.json(
      { error: "workType is invalid." },
      { status: 400 },
    );
  }
  try {
    const result = await answerChatbot({
      pitchText,
      workType: workType as WorkType,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LlmError && err.configured === false) {
      return NextResponse.json(
        { error: err.message, code: "llm-not-configured" },
        { status: 503 },
      );
    }
    const message = err instanceof LlmError ? err.message : "Chatbot failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
