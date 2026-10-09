import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    const update = (value: boolean) => {
      if (alive) setReduced(value);
    };
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      update,
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(update)
      .catch(() => update(true));
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);
  return reduced;
}
