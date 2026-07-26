import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/models";

// The 4.5 module can store the same decision principle in more than one phrasing
// (e.g. a first-person and a concise version). For DISPLAY — the reveal under the
// "Your decision principles" toggle in the share step — we collapse those to the
// distinct principles so the person sees a clean list, not apparent duplicates.
// This is display-only; the person still shares the whole set.

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

function extractJsonArray(s: string): string {
  const a = s.indexOf("[");
  const b = s.lastIndexOf("]");
  return a !== -1 && b !== -1 && b > a ? s.slice(a, b + 1) : "[]";
}

export async function dedupePrinciples(principles: string[]): Promise<string[]> {
  const clean = principles.map((p) => p.trim()).filter(Boolean);
  if (clean.length <= 1) return clean;

  const numbered = clean.map((p, i) => `${i}. ${p}`).join("\n");
  const system = `These are one person's decision principles. Some express the SAME idea in different words (e.g. a first-person and a concise version). Return the DISTINCT principles only — each idea once — in the person's own words, choosing the clearest single phrasing for each. Do not add, merge unrelated ideas, or invent anything. Keep them roughly in the given order.

Respond with ONLY a JSON array of strings, e.g. ["...","..."].`;

  try {
    const res = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: numbered }],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    const parsed = JSON.parse(extractJsonArray(text)) as unknown;
    if (!Array.isArray(parsed)) return clean;
    const out = parsed
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    // Guard against a bad response that dropped everything or ballooned.
    return out.length > 0 && out.length <= clean.length ? out : clean;
  } catch {
    return clean; // show the real principles rather than nothing
  }
}
