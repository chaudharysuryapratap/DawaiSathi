export type FamilyGroup = {
  id: string;
  name: string;
  owner_user_id?: string | null;
  member_ids: string[];
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type Account = {
  id: string;
  email: string;
  name: string;
  is_owner: boolean;
  created_at: string;
};

export type Member = {
  id: string;
  name: string;
  role: string;
  color: string;
  is_primary: boolean;
  family_group_ids: string[];
  created_at: string;
};

export type Medicine = {
  voice_note_url?: string;
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
  family_group_id: string | null;
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
  family_group_id: string | null;
};

export type MissedDoseEvent = {
  id: string;
  event_key: string;
  source_type: "medicine" | "protocol_step";
  medicine_id: string | null;
  protocol_id: string | null;
  protocol_name: string | null;
  step_order: number | null;
  medicine_name: string;
  dosage: string;
  time: string;
  detected_at: string;
  local_date: string;
  member_id: string | null;
  family_group_id: string;
};

export type MedicineInput = {
  voice_note_url?: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions: string;
  quantity_total: number;
  identification_cue?: string;
  image_url?: string;
  member_id?: string | null;
  family_group_id?: string | null;
  days?: number[];
};

export type Checkup = {
  voice_note_url?: string;
  id: string;
  title: string;
  doctor: string;
  location: string;
  scheduled_at: string;
  notes: string;
  member_id: string | null;
  family_group_id: string | null;
  created_at: string;
};

export type CheckupInput = {
  voice_note_url?: string;
  title: string;
  doctor?: string;
  location?: string;
  scheduled_at: string;
  notes?: string;
  member_id?: string | null;
  family_group_id?: string | null;
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
  protocol_id?: string | null;
  member_id?: string | null;
  family_group_id?: string | null;
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

// ---------------------------------------------------------------------------
// Staggered eye-drop protocols
// ---------------------------------------------------------------------------

export type EyeTarget = "left" | "right" | "both";

export type EyeDropStep = {
  order: number;
  medicine_name: string;
  dose: string;
  eye: EyeTarget;
};

export type EyeDropStepInput = {
  medicine_name: string;
  dose: string;
  eye: EyeTarget;
};

export type EyeDropProtocol = {
  voice_note_url?: string;
  id: string;
  name: string;
  start_time: string;
  interval_minutes: number;
  steps: EyeDropStep[];
  member_id: string | null;
  family_group_id: string | null;
  days: number[];
  active: boolean;
  created_at: string;
};

export type EyeDropProtocolInput = {
  voice_note_url?: string;
  name: string;
  start_time: string;
  interval_minutes: number;
  steps: EyeDropStepInput[];
  member_id?: string | null;
  family_group_id?: string | null;
  days?: number[];
};

export type TodayProtocolStep = {
  order: number;
  medicine_name: string;
  dose: string;
  eye: EyeTarget;
  time: string;
  logged_at: string | null;
  log_id: string | null;
};

export type TodayProtocol = {
  protocol_id: string;
  name: string;
  start_time: string;
  end_time: string;
  interval_minutes: number;
  time_slot: TimeSlot;
  member_id: string | null;
  member_name: string;
  steps: TodayProtocolStep[];
};

export type ProtocolStepLog = {
  id: string;
  protocol_id: string;
  protocol_name: string;
  step_order: number;
  medicine_name: string;
  dose: string;
  eye: EyeTarget;
  time: string;
  logged_at: string;
  local_date: string;
  member_id: string | null;
};

export type ProtocolStatus =
  | "upcoming"
  | "ready"
  | "in-progress"
  | "completed"
  | "partially-completed"
  | "late"
  | "missed";
