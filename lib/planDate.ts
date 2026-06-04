// Plan-date helpers for the commitment loop. The planned-next-module date is
// stored as a local calendar date (YYYY-MM-DD), so "today" must be computed in
// the user's own timezone — using the UTC date would shift the day either side
// of midnight and break the same-day match the recognition depends on.

export function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// True only when the stored ISO date is the user's local today. Earlier or
// later dates return false — the recognition fires on an exact match alone.
export function isTodayLocal(iso: string): boolean {
  return iso === todayISODate();
}
