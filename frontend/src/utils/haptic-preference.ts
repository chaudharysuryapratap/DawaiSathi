import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

const key = "dawaisathi.haptic-feedback";
let enabled = true;
let changed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
// Load once for all callers. A user change always wins over a late storage read.
void AsyncStorage.getItem(key).then(value => {
  if (!changed) { enabled = value !== "false"; notify(); }
}).catch(() => {});
export const hapticsEnabled = () => enabled;
export function setHapticsEnabled(value: boolean) {
  changed = true; enabled = value; notify();
  void AsyncStorage.setItem(key, String(value)).catch(() => {});
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const useHapticsEnabled = () => useSyncExternalStore(subscribe, hapticsEnabled, () => true);
