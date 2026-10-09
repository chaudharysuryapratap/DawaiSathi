import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
export type TextSize = "Normal" | "Large" | "Extra large";
const sizes: Record<TextSize, number> = { Normal: 1, Large: 1.15, "Extra large": 1.3 };
let selected: TextSize = "Normal";
let changed = false;
const listeners = new Set<() => void>();
void AsyncStorage.getItem("dawaisathi.text-size").then(value => {
    if (!changed && value && Object.hasOwn(sizes, value)) {
        selected = value as TextSize;
        listeners.forEach(fn => fn());
    }
}).catch(() => { });
export function setTextSize(value: TextSize) {
    changed = true;
    selected = value;
    listeners.forEach(fn => fn());
    void AsyncStorage.setItem("dawaisathi.text-size", value).catch(() => { });
}
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function useTextSize() { return useSyncExternalStore(subscribe, () => selected, () => "Normal" as TextSize); }
export function useTextMultiplier() { return sizes[useTextSize()]; }
