// Reading session times honestly.
//
// Pure functions, kept out of the admin view so they can be tested — the whole
// value of the timing data rests on these two not lying.

// The MEDIAN, not the mean. Session times are skewed by their nature: someone
// leaves a tab focused, or races through, and with a pilot-sized handful of
// people a single outlier sets the number. The median says "what a typical
// person experienced", which is the actual question being asked.
export function medianMs(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : s[mid];
}

// A duration as a person would say it. Sub-minute times are real — a skimmed
// session is a finding — and must not round away to "0m".
export function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}
