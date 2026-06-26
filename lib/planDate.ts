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

// Whole years between a date of birth (ISO YYYY-MM-DD) and today, or null if the
// input isn't a usable past date. Computed at read time so the age never goes
// stale. Used by the senses (2.6) hearing-check gate and the resolver's {age}
// filter — both prefer this real age over the coarse retirement-horizon signal,
// and fall back to the horizon when no DOB was given.
export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob || typeof dob !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const birth = new Date(year, month - 1, day);
  // Reject malformed dates (e.g. 2024-02-31 rolling over) and future dates.
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return null;
  }
  const now = new Date();
  if (birth.getTime() > now.getTime()) return null;
  let age = now.getFullYear() - year;
  const hadBirthday =
    now.getMonth() > month - 1 ||
    (now.getMonth() === month - 1 && now.getDate() >= day);
  if (!hadBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
