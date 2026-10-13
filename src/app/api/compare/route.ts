import { NextResponse } from "next/server";
import { answerChatbot } from "@/lib/agent/chatbot";
import { LlmError } from "@/lib/agent/llm-client";
import { markChatbotTitles } from "@/lib/qloo/mark";
import type { WorkType } from "@/lib/types";

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/**
 * §6.11 on the flow path: POST { pitchText, workType } -> the plain
 * chatbot answer with every title checked in Qloo. The prose is
 * ungrounded by design; only the marks are measured. Either side may
 * fail independently — the caller renders the honest empty state.
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
    const chat = await answerChatbot({
      pitchText,
      workType: workType as WorkType,
    });
    try {
      const marks = await markChatbotTitles(chat.titles, workType as WorkType);
      return NextResponse.json({
        chatbot: {
          answer: chat.answer,
          found: marks.found,
          notFoundTitles: marks.notFoundTitles,
        },
        error: null,
        calls: marks.calls,
      });
    } catch {
      return NextResponse.json({
        chatbot: null,
        error: "Chatbot titles could not be checked in Qloo.",
        calls: [],
      });
    }
  } catch (err) {
    if (err instanceof LlmError && err.configured === false) {
      return NextResponse.json({
        chatbot: null,
        error: "Chatbot comparison needs an LLM key.",
        calls: [],
      });
    }
    const message = err instanceof LlmError ? err.message : "Chatbot failed.";
    return NextResponse.json({
      chatbot: null,
      error: message,
      calls: [],
    });
  }
}
