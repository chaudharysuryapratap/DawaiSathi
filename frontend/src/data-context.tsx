import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "./api";
import type {
  AttentionItem,
  Checkup,
  CheckupInput,
  DoseLog,
  Medicine,
  MedicineInput,
  Member,
  TodayDose,
} from "./types";
import { storage } from "./utils/storage";

const ACTIVE_MEMBER_KEY = "dawaisathi:activeMember";

type DataContextValue = {
  members: Member[];
  activeMember: Member | null;
  activeMemberId: string | null;
  setActiveMember: (id: string | null) => void;
  medicines: Medicine[];
  activeMedicines: Medicine[];
  archivedMedicines: Medicine[];
  todayDoses: TodayDose[];
  history: DoseLog[];
  checkups: Checkup[];
  upcomingCheckup: Checkup | null;
  attention: AttentionItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addMember: (name: string, role?: string) => Promise<Member>;
  updateMember: (id: string, patch: { name?: string; role?: string }) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  addMedicine: (input: MedicineInput) => Promise<Medicine>;
  updateMedicine: (id: string, input: Partial<MedicineInput> & { active?: boolean }) => Promise<void>;
  archiveMedicine: (id: string) => Promise<void>;
  restoreMedicine: (id: string) => Promise<void>;
  refillMedicine: (id: string, quantity: number) => Promise<void>;
  logDose: (id: string, time: string) => Promise<void>;
  undoDose: (id: string, time: string, date?: string) => Promise<void>;
  addCheckup: (input: CheckupInput) => Promise<Checkup>;
  updateCheckup: (id: string, input: Partial<CheckupInput>) => Promise<void>;
  removeCheckup: (id: string) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [activeMemberId, setActiveMemberIdState] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [archivedMedicines, setArchivedMedicines] = useState<Medicine[]>([]);
  const [todayDoses, setTodayDoses] = useState<TodayDose[]>([]);
  const [history, setHistory] = useState<DoseLog[]>([]);
  const [checkups, setCheckups] = useState<Checkup[]>([]);
  const [upcomingCheckup, setUpcomingCheckup] = useState<Checkup | null>(null);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveMember = useCallback((id: string | null) => {
    setActiveMemberIdState(id);
    void storage.setItem(ACTIVE_MEMBER_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const stored = await storage.getItem<string | null>(ACTIVE_MEMBER_KEY, null);
      const [memberList, everyMedicine, activeMedicineList, checkupList, attentionData] = await Promise.all([
        api.members(),
        api.medicines(undefined, false),
        api.medicines(undefined, true),
        api.checkups(),
        api.attention(),
      ]);
      setMembers(memberList);
      const activeId = stored && memberList.some((member) => member.id === stored)
        ? stored
        : memberList.find((member) => member.is_primary)?.id ?? memberList[0]?.id ?? null;
      setActiveMemberIdState(activeId);
      if (activeId !== stored) {
        void storage.setItem(ACTIVE_MEMBER_KEY, activeId);
      }
      setMedicines(activeMedicineList);
      setArchivedMedicines(everyMedicine.filter((medicine) => !medicine.active));
      setCheckups(checkupList);
      setAttention(attentionData.items);
      const [todayData, historyData, upcoming] = await Promise.all([
        api.today(activeId),
        api.history({ memberId: activeId }),
        api.upcomingCheckup(activeId),
      ]);
      setTodayDoses(todayData.doses);
      setHistory(historyData);
      setUpcomingCheckup(upcoming);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load DawaiSathi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeMemberId) return;
    let cancelled = false;
    (async () => {
      try {
        const [todayData, historyData, upcoming] = await Promise.all([
          api.today(activeMemberId),
          api.history({ memberId: activeMemberId }),
          api.upcomingCheckup(activeMemberId),
        ]);
        if (cancelled) return;
        setTodayDoses(todayData.doses);
        setHistory(historyData);
        setUpcomingCheckup(upcoming);
      } catch {
        // silent: keep whatever previously loaded
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeMemberId]);

  const runAndRefresh = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      const result = await action();
      await refresh();
      return result;
    },
    [refresh],
  );

  const value = useMemo<DataContextValue>(() => {
    const activeMember = members.find((member) => member.id === activeMemberId) ?? null;
    return {
      members,
      activeMember,
      activeMemberId,
      setActiveMember,
      medicines,
      activeMedicines: medicines,
      archivedMedicines,
      todayDoses,
      history,
      checkups,
      upcomingCheckup,
      attention,
      loading,
      error,
      refresh,
      addMember: (name, role = "member") => runAndRefresh(() => api.createMember(name, role)),
      updateMember: async (id, patch) => {
        await runAndRefresh(() => api.updateMember(id, patch));
      },
      removeMember: async (id) => {
        await runAndRefresh(() => api.removeMember(id));
      },
      addMedicine: (input) => runAndRefresh(() => api.createMedicine(input)),
      updateMedicine: async (id, input) => {
        await runAndRefresh(() => api.updateMedicine(id, input));
      },
      archiveMedicine: async (id) => {
        await runAndRefresh(() => api.archiveMedicine(id));
      },
      restoreMedicine: async (id) => {
        await runAndRefresh(() => api.restoreMedicine(id));
      },
      refillMedicine: async (id, quantity) => {
        await runAndRefresh(() => api.refillMedicine(id, quantity));
      },
      logDose: async (id, time) => {
        await runAndRefresh(() => api.logDose(id, time));
      },
      undoDose: async (id, time, date) => {
        await runAndRefresh(() => api.undoDose(id, time, date));
      },
      addCheckup: (input) => runAndRefresh(() => api.createCheckup(input)),
      updateCheckup: async (id, input) => {
        await runAndRefresh(() => api.updateCheckup(id, input));
      },
      removeCheckup: async (id) => {
        await runAndRefresh(() => api.removeCheckup(id));
      },
    };
  }, [
    members,
    activeMemberId,
    setActiveMember,
    medicines,
    archivedMedicines,
    todayDoses,
    history,
    checkups,
    upcomingCheckup,
    attention,
    loading,
    error,
    refresh,
    runAndRefresh,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used inside DataProvider");
  return context;
}
