// Shared retry for the Stage-4 draft fetches (goals, goal-paths, trade-offs, week
// shape, first year, seasons cards). Each of these surfaces asks its /api route for
// an AI-drafted "seed" while the person reads the intro. A single slow response, a
// timeout, an overloaded model, a network blip, or a route-signalled failure
// ({seed:null}) used to drop the person onto a generic fallback with no recovery.
//
// This retries transient failures a few times with backoff before giving up. It
// returns the drafted seed on the first attempt that comes back valid, or null only
// after every attempt fails — the caller then shows its own fallback. A route that
// returns a real seed for genuinely-empty input (handled before the model call) comes
// back valid on the first try, so no retry is wasted.
export async function fetchSeedWithRetry<T>(
  url: string,
  input: unknown,
  isValid: (seed: T) => boolean,
  attempts = 3
): Promise<T | null> {
  const total = Math.max(1, attempts);
  for (let i = 0; i < total; i++) {
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
      // network error — fall through to the backoff and retry
    }
    // Back off a little between attempts (400ms, 800ms, …), never after the last.
    if (i < total - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return null;
}
