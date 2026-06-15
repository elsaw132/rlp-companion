// Bespoke imagery for the Retirement Life Plan — scenes, never faces.
//
// Each scene prompt (assembled in lib/rlpPlan from the member's real goals and
// first year) is rendered in ONE restrained, consistent style: soft, muted,
// painterly/illustrative — never the glossy "AI photo" look — grounded and warm,
// people absent or distant. The client caches the result so an image is generated
// once at plan creation, not per view.
//
// Provider: OpenAI via REST, reading OPENAI_API_KEY. With no key it returns
// { image: null } and the document keeps its tasteful placeholder. It tries
// gpt-image-1 first (best painterly results, and returns compact JPEG so the
// cached data URL stays small enough for the database); if that's unavailable —
// e.g. the OpenAI organisation hasn't completed image verification — it falls
// back to DALL·E 3 automatically, so imagery works either way.

export const maxDuration = 60;

// The single house style every image shares — the one lever for art direction,
// so the set hangs together and matches the product's brand illustration style
// (flat, modern, minimal vector — like the home-screen artwork).
const STYLE =
  "A modern, flat editorial illustration in a clean contemporary VECTOR style — simple geometric shapes, smooth soft gradients, crisp flat colour with NO visible brush texture, no grain, no outlines, no painterly or watercolour look, not a painting and not a photograph. Calm, airy and quietly optimistic, with generous negative space; gently abstracted and minimal rather than detailed or literal — render the subject in just a few clean, simple forms. Warm, soft, harmonious palette of pale sky blue (around #C9E0EE), soft sage and layered greens (around #5B9F4A and #3F7F36), warm cream and sand (around #C7A53A), a small soft sun (around #FBD24E), with occasional gentle lavender — light and uplifting, never dark, muted, sepia or vintage. IMPORTANT: depict the specific subject described below — show clearly what it is about (for example a journey to another country, an artist's studio and easel, a vegetable garden, a sports court or club, a workshop, a coastline, a long table) — do not default to a generic cottage-and-hills scene. A British / European sensibility (never American suburbia), but set the scene wherever the subject calls for. Prefer NO people at all — let the place and objects carry it. If a figure is truly needed it must be a single tiny, simple, faceless silhouette far in the background — NEVER a large or foreground person, never facial features, never the focus of the image. The overall feel is a tasteful, understated brand illustration: flat, contemporary and serene.";

type ImageRequest = { prompt?: string };

async function openai(path: string, key: string, body: unknown): Promise<Response> {
  return fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
}

// Primary: gpt-image-1, JPEG output so the base64 data URL is small (~150–300KB)
// — important because the image is cached in the user_data row.
async function viaGptImage1(key: string, prompt: string): Promise<string | null> {
  const res = await openai("images/generations", key, {
    model: "gpt-image-1",
    prompt: `${prompt}\n\nStyle: ${STYLE}`,
    size: "1536x1024",
    quality: "medium",
    output_format: "jpeg",
    output_compression: 80,
    n: 1,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[plan-image] gpt-image-1 — status=${res.status} ${detail.slice(0, 200)}`);
    return null;
  }
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  return b64 ? `data:image/jpeg;base64,${b64}` : null;
}

// Fallback: DALL·E 3 (widely available, no image verification needed). Returns a
// PNG, requested at 1024x1024 to keep the cached data URL manageable.
async function viaDalle3(key: string, prompt: string): Promise<string | null> {
  const res = await openai("images/generations", key, {
    model: "dall-e-3",
    prompt: `${prompt}\n\nStyle: ${STYLE}`,
    size: "1792x1024",
    quality: "standard",
    response_format: "b64_json",
    n: 1,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[plan-image] dall-e-3 — status=${res.status} ${detail.slice(0, 200)}`);
    return null;
  }
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  return b64 ? `data:image/png;base64,${b64}` : null;
}

async function generate(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const primary = await viaGptImage1(key, prompt);
  if (primary) return primary;
  return viaDalle3(key, prompt);
}

export async function POST(request: Request): Promise<Response> {
  let body: ImageRequest;
  try {
    body = (await request.json()) as ImageRequest;
  } catch {
    return Response.json({ image: null });
  }
  const prompt = body.prompt?.trim();
  if (!prompt) return Response.json({ image: null });

  try {
    const image = await generate(prompt);
    return Response.json({ image });
  } catch (error) {
    console.error("[plan-image] Unexpected error:", error);
    return Response.json({ image: null });
  }
}
