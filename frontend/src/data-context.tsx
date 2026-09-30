import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api } from "./api";
import type {
  AttentionItem,
  Checkup,
  CheckupInput,
  DoseLog,
  EyeDropProtocol,
  EyeDropProtocolInput,
  FamilyGroup,
  Medicine,
  MedicineInput,
  Member,
  ProtocolStepLog,
  TodayDose,
  TodayProtocol,
} from "./types";
import { storage } from "./utils/storage";

const ACTIVE_MEMBER_KEY = "dawaisathi:activeMember";
const ACTIVE_FAMILY_GROUP_KEY = "dawaisathi:activeFamilyGroup";

type DataContextValue = {
  familyGroups: FamilyGroup[];
  activeFamilyGroup: FamilyGroup | null;
  activeFamilyGroupId: string | null;
  setActiveFamilyGroup: (id: string | null) => void;
  createFamilyGroup: (name: string) => Promise<FamilyGroup>;
  renameFamilyGroup: (id: string, name: string) => Promise<void>;
  members: Member[];
  activeMember: Member | null;
  activeMemberId: string | null;
  setActiveMember: (id: string | null) => void;
  medicines: Medicine[];
  activeMedicines: Medicine[];
  archivedMedicines: Medicine[];
  protocols: EyeDropProtocol[];
  todayDoses: TodayDose[];
  todayProtocols: TodayProtocol[];
  history: DoseLog[];
  protocolHistory: ProtocolStepLog[];
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
  addProtocol: (input: EyeDropProtocolInput) => Promise<EyeDropProtocol>;
  updateProtocol: (id: string, input: Partial<EyeDropProtocolInput> & { active?: boolean }) => Promise<void>;
  archiveProtocol: (id: string) => Promise<void>;
  logProtocolStep: (id: string, order: number) => Promise<void>;
  undoProtocolStep: (id: string, order: number, date?: string) => Promise<void>;
  addCheckup: (input: CheckupInput) => Promise<Checkup>;
  updateCheckup: (id: string, input: Partial<CheckupInput>) => Promise<void>;
  removeCheckup: (id: string) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const loadGeneration = useRef(0);
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [activeFamilyGroupId, setActiveFamilyGroupIdState] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeMemberId, setActiveMemberIdState] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [archivedMedicines, setArchivedMedicines] = useState<Medicine[]>([]);
  const [protocols, setProtocols] = useState<EyeDropProtocol[]>([]);
  const [todayDoses, setTodayDoses] = useState<TodayDose[]>([]);
  const [todayProtocols, setTodayProtocols] = useState<TodayProtocol[]>([]);
  const [history, setHistory] = useState<DoseLog[]>([]);
  const [protocolHistory, setProtocolHistory] = useState<ProtocolStepLog[]>([]);
  const [checkups, setCheckups] = useState<Checkup[]>([]);
  const [upcomingCheckup, setUpcomingCheckup] = useState<Checkup | null>(null);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveMember = useCallback((id: string | null) => {
    setActiveMemberIdState(id);
    void storage.setItem(ACTIVE_MEMBER_KEY, id);
  }, []);

  const setActiveFamilyGroup = useCallback((id: string | null) => {
    setActiveFamilyGroupIdState(id);
    setLoading(true);
    void storage.setItem(ACTIVE_FAMILY_GROUP_KEY, id);
  }, []);

  const loadGroupData = useCallback(async (groupId: string) => {
    const generation = ++loadGeneration.current;
    const storedMember = await storage.getItem<string | null>(ACTIVE_MEMBER_KEY, null);
    const memberList = await api.members(groupId);
    if (generation !== loadGeneration.current) return;
    setMembers(memberList);

    const nextMemberId =
      storedMember && memberList.some((member) => member.id === storedMember)
        ? storedMember
        : memberList.find((member) => member.is_primary)?.id ?? memberList[0]?.id ?? null;

    setActiveMemberIdState(nextMemberId);
    if (nextMemberId !== storedMember) {
      void storage.setItem(ACTIVE_MEMBER_KEY, nextMemberId);
    }

    const [everyMedicine, activeMedicineList, protocolList, checkupList, attentionData] = await Promise.all([
      api.medicines(undefined, false, groupId),
      api.medicines(undefined, true, groupId),
      api.protocols(undefined, true, groupId),
      api.checkups(undefined, groupId),
      api.attention(groupId),
    ]);

    if (generation !== loadGeneration.current) return;
    setMedicines(activeMedicineList);
    setArchivedMedicines(everyMedicine.filter((medicine) => !medicine.active));
    setProtocols(protocolList);
    setCheckups(checkupList);
    setAttention(attentionData.items);

    const [todayData, historyData, protocolHistoryData, upcoming] = await Promise.all([
      api.today(nextMemberId, groupId),
      api.history({ memberId: nextMemberId, familyGroupId: groupId }),
      api.protocolHistory({ memberId: nextMemberId, familyGroupId: groupId }),
      api.upcomingCheckup(nextMemberId, groupId),
    ]);

    if (generation !== loadGeneration.current) return;
    setTodayDoses(todayData.doses);
    setTodayProtocols(todayData.protocols ?? []);
    setHistory(historyData);
    setProtocolHistory(protocolHistoryData);
    setUpcomingCheckup(upcoming);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const groups = await api.familyGroups();
      setFamilyGroups(groups);

      const storedGroup = await storage.getItem<string | null>(ACTIVE_FAMILY_GROUP_KEY, null);
      const groupId =
        storedGroup && groups.some((group) => group.id === storedGroup)
          ? storedGroup
          : groups[0]?.id ?? null;

      setActiveFamilyGroupIdState(groupId);
      if (groupId !== storedGroup) {
        void storage.setItem(ACTIVE_FAMILY_GROUP_KEY, groupId);
      }

      if (groupId) {
        await loadGroupData(groupId);
      } else {
        setMembers([]);
        setActiveMemberIdState(null);
        setMedicines([]);
        setArchivedMedicines([]);
        setProtocols([]);
        setTodayDoses([]);
        setTodayProtocols([]);
        setHistory([]);
        setProtocolHistory([]);
        setCheckups([]);
        setUpcomingCheckup(null);
        setAttention([]);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load DawaiSathi.");
    } finally {
      setLoading(false);
    }
  }, [loadGroupData]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  useEffect(() => {
    if (!activeFamilyGroupId) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoading(true);
        return loadGroupData(activeFamilyGroupId);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to load this family group.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeFamilyGroupId, loadGroupData]);

  useEffect(() => {
    if (!activeFamilyGroupId || !activeMemberId) return;
    let cancelled = false;
    void Promise.all([
      api.today(activeMemberId, activeFamilyGroupId),
      api.history({ memberId: activeMemberId, familyGroupId: activeFamilyGroupId }),
      api.protocolHistory({ memberId: activeMemberId, familyGroupId: activeFamilyGroupId }),
      api.upcomingCheckup(activeMemberId, activeFamilyGroupId),
    ])
      .then(([todayData, historyData, protocolHistoryData, upcoming]) => {
        if (cancelled) return;
        setTodayDoses(todayData.doses);
        setTodayProtocols(todayData.protocols ?? []);
        setHistory(historyData);
        setProtocolHistory(protocolHistoryData);
        setUpcomingCheckup(upcoming);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load this member's care data.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeFamilyGroupId, activeMemberId]);

  const runAndRefresh = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      const result = await action();
      await refresh();
      return result;
    },
    [refresh],
  );

  const value = useMemo<DataContextValue>(() => {
    const activeFamilyGroup = familyGroups.find((group) => group.id === activeFamilyGroupId) ?? null;
    const activeMember = members.find((member) => member.id === activeMemberId) ?? null;

    return {
      familyGroups,
      activeFamilyGroup,
      activeFamilyGroupId,
      setActiveFamilyGroup,
      createFamilyGroup: async (name) => {
        const created = await api.createFamilyGroup(name);
        await refresh();
        setActiveFamilyGroup(created.id);
        return created;
      },
      renameFamilyGroup: async (id, name) => {
        await runAndRefresh(() => api.renameFamilyGroup(id, name));
      },
      members,
      activeMember,
      activeMemberId,
      setActiveMember,
      medicines,
      activeMedicines: medicines,
      archivedMedicines,
      protocols,
      todayDoses,
      todayProtocols,
      history,
      protocolHistory,
      checkups,
      upcomingCheckup,
      attention,
      loading,
      error,
      refresh,
      addMember: (name, role = "member") =>
        runAndRefresh(() => api.createMember(name, role, activeFamilyGroupId)),
      updateMember: async (id, patch) => {
        await runAndRefresh(() => api.updateMember(id, patch));
      },
      removeMember: async (id) => {
        await runAndRefresh(() => api.removeMember(id));
      },
      addMedicine: (input) =>
        runAndRefresh(() =>
          api.createMedicine({
            ...input,
            family_group_id: input.family_group_id ?? activeFamilyGroupId,
          }),
        ),
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
        const previous = todayDoses.find(
          (dose) => dose.medicine_id === id && dose.time === time,
        );

        if (!previous) {
          await runAndRefresh(() => api.logDose(id, time));
          return;
        }

        const optimisticLoggedAt = new Date().toISOString();

        setTodayDoses((current) =>
          current.map((dose) =>
            dose.dose_id === previous.dose_id
              ? {
                  ...dose,
                  logged_at: optimisticLoggedAt,
                  log_id: "pending",
                }
              : dose,
          ),
        );

        try {
          const saved = await api.logDose(id, time);

          setTodayDoses((current) =>
            current.map((dose) =>
              dose.dose_id === previous.dose_id
                ? {
                    ...dose,
                    logged_at: saved.logged_at,
                    log_id: saved.id,
                  }
                : dose,
            ),
          );

          await refresh();
        } catch (requestError) {
          setTodayDoses((current) =>
            current.map((dose) =>
              dose.dose_id === previous.dose_id
                ? {
                    ...dose,
                    logged_at: previous.logged_at,
                    log_id: previous.log_id,
                  }
                : dose,
            ),
          );

          throw requestError;
        }
      },
      undoDose: async (id, time, date) => {
        const previous = todayDoses.find(
          (dose) => dose.medicine_id === id && dose.time === time,
        );

        if (!previous) {
          await runAndRefresh(() => api.undoDose(id, time, date));
          return;
        }

        setTodayDoses((current) =>
          current.map((dose) =>
            dose.dose_id === previous.dose_id
              ? { ...dose, logged_at: null, log_id: null }
              : dose,
          ),
        );

        try {
          await api.undoDose(id, time, date);

          await refresh();
        } catch (requestError) {
          setTodayDoses((current) =>
            current.map((dose) =>
              dose.dose_id === previous.dose_id
                ? {
                    ...dose,
                    logged_at: previous.logged_at,
                    log_id: previous.log_id,
                  }
                : dose,
            ),
          );

          throw requestError;
        }
      },
      addProtocol: (input) =>
        runAndRefresh(() =>
          api.createProtocol({
            ...input,
            family_group_id: input.family_group_id ?? activeFamilyGroupId,
          }),
        ),
      updateProtocol: async (id, input) => {
        await runAndRefresh(() => api.updateProtocol(id, input));
      },
      archiveProtocol: async (id) => {
        await runAndRefresh(() => api.archiveProtocol(id));
      },
      logProtocolStep: async (id, order) => {
        await runAndRefresh(() => api.logProtocolStep(id, order));
      },
      undoProtocolStep: async (id, order, date) => {
        await runAndRefresh(() => api.undoProtocolStep(id, order, date));
      },
      addCheckup: (input) =>
        runAndRefresh(() =>
          api.createCheckup({
            ...input,
            family_group_id: input.family_group_id ?? activeFamilyGroupId,
          }),
        ),
      updateCheckup: async (id, input) => {
        await runAndRefresh(() => api.updateCheckup(id, input));
      },
      removeCheckup: async (id) => {
        await runAndRefresh(() => api.removeCheckup(id));
      },
    };
  }, [
    familyGroups,
    activeFamilyGroupId,
    setActiveFamilyGroup,
    members,
    activeMemberId,
    setActiveMember,
    medicines,
    archivedMedicines,
    protocols,
    todayDoses,
    todayProtocols,
    history,
    protocolHistory,
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
