import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "./api";
import type { DoseLog, Medicine, MedicineInput, TodayDose } from "./types";

type DataContextValue = {
  medicines: Medicine[];
  todayDoses: TodayDose[];
  history: DoseLog[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addMedicine: (input: MedicineInput) => Promise<void>;
  updateMedicine: (id: string, input: Partial<MedicineInput>) => Promise<void>;
  archiveMedicine: (id: string) => Promise<void>;
  logDose: (id: string, time: string) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [todayDoses, setTodayDoses] = useState<TodayDose[]>([]);
  const [history, setHistory] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [medicineData, todayData, historyData] = await Promise.all([
        api.medicines(),
        api.today(),
        api.history(),
      ]);
      setMedicines(medicineData);
      setTodayDoses(todayData.doses);
      setHistory(historyData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load your medicines.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAndRefresh = useCallback(async (action: () => Promise<unknown>) => {
    await action();
    await refresh();
  }, [refresh]);

  const value = useMemo<DataContextValue>(() => ({
    medicines,
    todayDoses,
    history,
    loading,
    error,
    refresh,
    addMedicine: (input) => runAndRefresh(() => api.createMedicine(input)),
    updateMedicine: (id, input) => runAndRefresh(() => api.updateMedicine(id, input)),
    archiveMedicine: (id) => runAndRefresh(() => api.archiveMedicine(id)),
    logDose: (id, time) => runAndRefresh(() => api.logDose(id, time)),
  }), [medicines, todayDoses, history, loading, error, refresh, runAndRefresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used inside DataProvider");
  return context;
}