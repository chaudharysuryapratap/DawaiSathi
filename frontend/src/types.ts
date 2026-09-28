export type Member = {
  id: string;
  name: string;
  role: string;
  color: string;
  is_primary: boolean;
  created_at: string;
};

export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions: string;
  quantity_total: number;
  quantity_remaining: number;
  identification_cue: string;
  image_url: string;
  active: boolean;
  member_id: string | null;
  days: number[];
  created_at: string;
};

export type DoseStatus =
  | "locked"
  | "ready"
  | "late"
  | "missed"
  | "taken"
  | "taken-late"
  | "taken-very-late";

export type TimeSlot = "morning" | "afternoon" | "evening" | "night";

export type TodayDose = {
  dose_id: string;
  medicine_id: string;
  medicine_name: string;
  dosage: string;
  instructions: string;
  time: string;
  time_slot: TimeSlot;
  member_id: string | null;
  member_name: string;
  identification_cue: string;
  image_url: string;
  logged_at: string | null;
  log_id: string | null;
};

export type DoseLog = {
  id: string;
  medicine_id: string;
  medicine_name: string;
  dosage: string;
  time: string;
  logged_at: string;
  local_date: string;
  member_id: string | null;
};

export type MedicineInput = {
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions: string;
  quantity_total: number;
  identification_cue?: string;
  image_url?: string;
  member_id?: string | null;
  days?: number[];
};

export type Checkup = {
  id: string;
  title: string;
  doctor: string;
  location: string;
  scheduled_at: string;
  notes: string;
  member_id: string | null;
  created_at: string;
};

export type CheckupInput = {
  title: string;
  doctor?: string;
  location?: string;
  scheduled_at: string;
  notes?: string;
  member_id?: string | null;
};

export type AttentionKind =
  | "missed-dose"
  | "late-dose"
  | "refill"
  | "checkup"
  | "family-request";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  when: string;
  medicine_id?: string | null;
  checkup_id?: string | null;
  member_id?: string | null;
};

export type NotificationPreference = {
  medicine_reminders: boolean;
  checkup_reminders: boolean;
  reminder_sound: boolean;
  voice_reminders: boolean;
  push_enabled: boolean;
  whatsapp_linked: boolean;
  telegram_linked: boolean;
};
