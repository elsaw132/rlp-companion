// Shared retry for the Stage-4 draft fetches (goals, goal-paths, trade-offs, week
// shape, first year, seasons cards). Each of these surfaces asks its /api route for
// an AI-drafted "seed" while the person reads the intro.
//
// These drafts are SLOW on purpose — a rich profile takes ~35s of model generation,
// close to the route's timeout. So the retry has to be careful: retrying a FAST
// failure (a quick 5xx, a network blip, an overloaded-and-refused call) is worth it,
// but retrying a SLOW failure — one that already ran near the timeout — just stacks
// another 35s+ wait and almost never succeeds. So we only retry when the failed
// attempt came back QUICKLY; a slow failure gives up immediately and lets the caller
// show its fallback. Returns the drafted seed on the first valid attempt, or null.
// A route that returns a real seed for genuinely-empty input comes back valid on the
// first try, so no retry is wasted.

// Only a failure faster than this is worth retrying; a slower one means the backend
// itself is slow, so another attempt would just double the wait.
const FAST_FAILURE_MS = 12_000;

export async function fetchSeedWithRetry<T>(
  url: string,
  input: unknown,
  isValid: (seed: T) => boolean,
  attempts = 3
): Promise<T | null> {
  const total = Math.max(1, attempts);
  for (let i = 0; i < total; i++) {
    const startedAt = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const data = (await res.json()) as { seed: T | null };
        if (data.seed && isValid(data.seed)) return data.seed;
      }
    } catch {
      // network error — a retry candidate, subject to the speed check below
    }
    // Give up rather than retry if this attempt was slow (near the timeout) — another
    // attempt would only stack the wait — or if this was the last attempt.
    const wasSlow = Date.now() - startedAt > FAST_FAILURE_MS;
    if (wasSlow || i >= total - 1) break;
    // Brief backoff before retrying a fast failure (400ms, 800ms, …).
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return null;
}
