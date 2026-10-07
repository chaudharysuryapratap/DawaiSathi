import { useState } from "react";
import { View } from "react-native";

import { PrimaryButton } from "@/src/components/dawai-ui";
import { useTheme } from "@/src/theme";

export function MedicineTimePicker({ onSelect, disabled }: { onSelect: (time: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <input
        type="time"
        aria-label="Choose reminder time"
        data-testid="medicine-time-picker"
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        style={{ minHeight: 48, padding: "0 14px", borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surfaceSecondary, color: colors.onSurface, fontSize: 16 }}
      />
      <PrimaryButton testID="medicine-time-confirm" label="Add time" icon="time-outline" variant="secondary" disabled={disabled || !value} onPress={() => {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return;
        onSelect(value);
        setValue("");
      }} />
    </View>
  );
}
