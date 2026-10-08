import type { Checkup } from "./types";

/** Today is a calendar-date view; upcoming/past are exact-time views. */
export function checkupSchedule(checkups: Checkup[], now: Date, memberId?: string | null) {
  const valid = checkups.filter(item => Number.isFinite(new Date(item.scheduled_at).getTime()));
  const time = (item: Checkup) => new Date(item.scheduled_at).getTime();
  const upcoming = valid.filter(item => time(item) >= now.getTime()).sort((a, b) => time(a) - time(b));
  const past = valid.filter(item => time(item) < now.getTime()).sort((a, b) => time(b) - time(a));
  const today = valid.filter(item => new Date(item.scheduled_at).toDateString() === now.toDateString() && (!memberId || !item.member_id || item.member_id === memberId)).sort((a, b) => time(a) - time(b));
  return { today, upcoming, past, next: upcoming[0] ?? null };
}
