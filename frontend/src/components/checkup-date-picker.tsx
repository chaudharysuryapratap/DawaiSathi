import PressableScale from "@/src/components/ui/PressableScale";
import { useState } from "react";
import { Text, View } from "react-native";
import { BottomSheet } from "./bottom-sheet";
import { PrimaryButton } from "./dawai-ui";
import { useTheme } from "@/src/theme";

export function CheckupDatePicker({ value, onSelect }: { value: Date; onSelect: (date: Date) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false), [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return <>
    <PrimaryButton testID="checkup-date-select" variant="secondary" icon="calendar-outline" label={value.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} onPress={() => { setMonth(new Date(value.getFullYear(), value.getMonth(), 1)); setOpen(true); }} />
    <BottomSheet visible={open} onClose={() => setOpen(false)} title="Choose a date" scrollable={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <PressableScale accessibilityLabel="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ padding: 14 }}><Text style={{ color: colors.brandPrimary, fontSize: 24 }}>‹</Text></PressableScale>
        <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
        <PressableScale accessibilityLabel="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={{ padding: 14 }}><Text style={{ color: colors.brandPrimary, fontSize: 24 }}>›</Text></PressableScale>
      </View>
      <View style={{ flexDirection: "row" }}>{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => <Text key={day} style={{ width: "14.28%", textAlign: "center", color: colors.muted }}>{day}</Text>)}</View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {Array.from({ length: month.getDay() }, (_, i) => <View key={`blank-${i}`} style={{ width: "14.28%" }} />)}
        {Array.from({ length: count }, (_, i) => { const day = new Date(month.getFullYear(), month.getMonth(), i + 1); const selected = day.toDateString() === value.toDateString(); return <PressableScale key={i} accessibilityRole="button" accessibilityLabel={day.toDateString()} accessibilityState={{ selected }} onPress={() => { onSelect(day); setOpen(false); }} style={{ width: "14.28%", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: selected ? colors.brandTertiary : colors.surface }}><Text style={{ color: selected ? colors.brandPrimary : colors.onSurface }}>{i + 1}</Text></PressableScale>; })}
      </View>
    </BottomSheet>
  </>;
}
