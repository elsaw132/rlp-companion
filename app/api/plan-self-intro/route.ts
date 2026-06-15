import Anthropic from "@anthropic-ai/sdk";

// Rewrites the member's self-introduction at a different TONE on demand
// (warmer / wryer / shorter) — the TOPIC stays exactly the same, only the
// register flexes. Returns { text } (the rewrite), or { text: null } on failure
// so the client keeps the current wording.

export const maxDuration = 20;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });

type Req = { current?: string; tone?: "warmer" | "wryer" | "shorter" };

const TONE_GUIDE: Record<string, string> = {
  warmer: "Make it warmer and more affectionate, without becoming sentimental.",
  wryer: "Give it a lightly wry, gently humorous edge, while staying sincere.",
  shorter: "Make it noticeably shorter and crisper — one or two tight sentences.",
};

export async function POST(request: Request): Promise<Response> {
  let body: Req;
  try {
    body = (await request.json()) as Req;
  } catch {
    return Response.json({ text: null });
  }
  const current = body.current?.trim();
  const tone = body.tone && TONE_GUIDE[body.tone] ? body.tone : null;
  if (!current || !tone) return Response.json({ text: null });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: `You rewrite a person's first-person self-introduction at a different tone. Keep the SAME content and the same facts — only the tone changes; never add new topics or drop the ones present. Stay in the first person ("I", "my"). British English. Never use the words reflect, explore, journey, growth, genuinely. Respond with ONLY the rewritten introduction as plain text — no quotes, no preamble.`,
      messages: [
        {
          role: "user",
          content: `${TONE_GUIDE[tone]}\n\nHere is my self-introduction:\n\n${current}`,
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return Response.json({ text: text || null });
  } catch {
    return Response.json({ text: null });
  }
}
