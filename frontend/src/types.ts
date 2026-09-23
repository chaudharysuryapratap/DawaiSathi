export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions: string;
  quantity_total: number;
  quantity_remaining: number;
  active: boolean;
  created_at: string;
};

export type TodayDose = {
  dose_id: string;
  medicine_id: string;
  medicine_name: string;
  dosage: string;
  time: string;
  instructions: string;
  status: "taken" | "upcoming";
};

export type DoseLog = {
  id: string;
  medicine_id: string;
  medicine_name: string;
  dosage: string;
  time: string;
  logged_at: string;
  local_date: string;
};

export type MedicineInput = {
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions: string;
  quantity_total: number;
};