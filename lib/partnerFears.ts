import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/models";

// Classifies which of a person's fears are about their partner or the
// relationship, so the share step can default those OFF (the person still sees
// every fear and can turn any back on — this only sets the starting state).
//
// The stakes are asymmetric: a false positive just defaults a neutral fear off
// and the person re-enables it (harmless); a false negative lets a
// relationship-directed fear default on and reach the shared view without a
// conscious choice — the exact harm the carve-out exists to prevent. So both the
// model prompt and the fallback err TOWARD "about partner" when uncertain.

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

// Relationship / partner-directed cues for the fallback. Deliberately broad.
const RELATIONSHIP_HINT =
  /\b(partner|spouse|husband|wife|marriage|married|relationship|each other|one another|together|apart|drift|drifting|him|her|them|we\b|us\b|couple)\b/i;

function keywordFallback(
  fears: { ref: string; label: string }[],
  partnerFirstName: string
): string[] {
  const name = partnerFirstName.trim();
  const nameRe =
    name && /^[a-z]+$/i.test(name)
      ? new RegExp(`\\b${name}\\b`, "i")
      : null;
  return fears
    .filter(
      (f) =>
        (nameRe && nameRe.test(f.label)) || RELATIONSHIP_HINT.test(f.label)
    )
    .map((f) => f.ref);
}

function extractJsonArray(s: string): string {
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return "[]";
  return s.slice(start, end + 1);
}

// Returns the subset of fear refs that are about the partner/relationship.
export async function classifyPartnerFears(
  fears: { ref: string; label: string }[],
  partnerFirstName: string
): Promise<string[]> {
  if (fears.length === 0) return [];

  const name = partnerFirstName.trim() || "their partner";
  const numbered = fears.map((f, i) => `${i}. ${f.label}`).join("\n");

  const system = `You decide which of a person's stated retirement fears are about their PARTNER or their RELATIONSHIP with that partner, as opposed to fears about themselves, their health, money, work, purpose, or the world in general.

The partner's first name is "${name}". A fear counts as about the partner/relationship if it concerns: the partner directly, the couple, growing apart or drifting, wanting different things from each other, one outliving the other, resentment or distance between them, or caring for the partner.

Bias: when a fear COULD reasonably be read as about the relationship, include it. It is far worse to miss one than to over-include.

You are given a numbered list of fears. Respond with ONLY a JSON array of the integer indexes that are about the partner/relationship, e.g. [0,3]. If none, respond [].`;

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 200,
      system,
      messages: [{ role: "user", content: numbered }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    const parsed = JSON.parse(extractJsonArray(text)) as unknown;
    if (!Array.isArray(parsed)) return keywordFallback(fears, partnerFirstName);
    const refs: string[] = [];
    for (const idx of parsed) {
      const n = typeof idx === "number" ? idx : Number(idx);
      if (Number.isInteger(n) && n >= 0 && n < fears.length) {
        refs.push(fears[n].ref);
      }
    }
    return refs;
  } catch {
    // Model or parse failure: fall back to the keyword match rather than
    // defaulting everything on (which would risk the false negative).
    return keywordFallback(fears, partnerFirstName);
  }
}
