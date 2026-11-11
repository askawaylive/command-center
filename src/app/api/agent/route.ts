import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runAgent, type ChatTurn } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { text: "I'm not connected yet. Add your ANTHROPIC_API_KEY to .env.local and restart the app, then ask me anything about your businesses." },
      { status: 200 },
    );
  }
  const { messages } = (await req.json()) as { messages: ChatTurn[] };
  try {
    return NextResponse.json(await runAgent(messages));
  } catch (error) {
    let text = "Something went wrong talking to Claude.";
    if (error instanceof Anthropic.AuthenticationError) text = "Your Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.";
    else if (error instanceof Anthropic.RateLimitError) text = "Claude is rate limited right now. Try again in a moment.";
    else if (error instanceof Anthropic.APIError) text = `Claude API error ${error.status}: ${error.message}`;
    console.error(error);
    return NextResponse.json({ text }, { status: 200 });
  }
}
