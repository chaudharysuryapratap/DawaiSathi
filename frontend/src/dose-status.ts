import type { DoseStatus, TimeSlot } from "./types";

export const TIME_SLOTS: TimeSlot[] = ["morning", "afternoon", "evening", "night"];

export const TIME_SLOT_LABEL: Record<TimeSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

export function computeDoseStatus(
  time: string,
  loggedAt: string | null,
  now: Date = new Date(),
): DoseStatus {
  const [hour, minute] = time.split(":").map(Number);
  const scheduled = new Date(now);
  scheduled.setHours(hour, minute, 0, 0);
  if (loggedAt) {
    const deltaMinutes = (new Date(loggedAt).getTime() - scheduled.getTime()) / 60000;
    if (deltaMinutes <= 30) return "taken";
    if (deltaMinutes <= 180) return "taken-late";
    return "taken-very-late";
  }
  const deltaMinutes = (now.getTime() - scheduled.getTime()) / 60000;
  if (deltaMinutes < -60) return "locked";
  if (deltaMinutes < 15) return "ready";
  if (deltaMinutes < 180) return "late";
  return "missed";
}

export const STATUS_LABEL: Record<DoseStatus, string> = {
  locked: "Upcoming",
  ready: "Ready",
  late: "Late",
  missed: "Missed",
  taken: "Taken",
  "taken-late": "Taken late",
  "taken-very-late": "Taken very late",
};

export function formatTime(value: string): string {
  const [hourValue, minute] = value.split(":").map(Number);
  const suffix = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatDoseTime(value: string): string {
  return value;
}

export function formatIsoDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(options ?? {}),
  });
}

export function formatIsoDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeCheckup(value: string): string {
  const scheduled = new Date(value);
  const now = new Date();
  const days = Math.floor((scheduled.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return `Today · ${scheduled.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  if (days === 1) return `Tomorrow · ${scheduled.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  return scheduled.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
