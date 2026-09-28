import { computeDoseStatus } from "@/src/dose-status";
import type {
  DoseStatus,
  EyeTarget,
  ProtocolStatus,
  TodayProtocolStep,
} from "@/src/types";

export type StepView = TodayProtocolStep & { status: DoseStatus };

export function stepStatuses(steps: TodayProtocolStep[], now: Date = new Date()): StepView[] {
  return steps.map((step) => ({
    ...step,
    status: computeDoseStatus(step.time, step.logged_at, now),
  }));
}

export function protocolOverallStatus(views: StepView[]): ProtocolStatus {
  if (views.length === 0) return "upcoming";
  const takenStatuses: DoseStatus[] = ["taken", "taken-late", "taken-very-late"];
  const taken = views.filter((view) => takenStatuses.includes(view.status));
  if (taken.length === views.length) return "completed";
  const anyReady = views.some((view) => view.status === "ready");
  const anyMissed = views.some((view) => view.status === "missed");
  const anyLate = views.some((view) => view.status === "late");
  const allLocked = views.every((view) => view.status === "locked");
  if (taken.length > 0 && !anyReady && !anyLate) {
    return "partially-completed";
  }
  if (taken.length > 0) return "in-progress";
  if (anyReady) return "ready";
  if (allLocked) return "upcoming";
  if (anyMissed && !anyLate && !anyReady) return "missed";
  if (anyLate) return "late";
  return "upcoming";
}

export function nextActionableStep(views: StepView[]): StepView | null {
  return (
    views.find((view) => view.status === "ready" || view.status === "late") ??
    views.find((view) => view.status === "missed") ??
    null
  );
}

export const PROTOCOL_STATUS_LABEL: Record<ProtocolStatus, string> = {
  upcoming: "Upcoming",
  ready: "Ready",
  "in-progress": "In progress",
  completed: "Completed",
  "partially-completed": "Partially completed",
  late: "Late",
  missed: "Missed",
};

export const EYE_LABEL: Record<EyeTarget, string> = {
  left: "Left eye",
  right: "Right eye",
  both: "Both eyes",
};

export function protocolStatusToDoseStatus(status: ProtocolStatus): DoseStatus {
  switch (status) {
    case "completed":
      return "taken";
    case "partially-completed":
      return "taken-late";
    case "in-progress":
    case "ready":
      return "ready";
    case "late":
      return "late";
    case "missed":
      return "missed";
    case "upcoming":
    default:
      return "locked";
  }
}
