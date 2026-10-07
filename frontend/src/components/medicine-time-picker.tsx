import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform } from "react-native";

import { BottomSheet } from "@/src/components/bottom-sheet";
import { PrimaryButton } from "@/src/components/dawai-ui";

type Props = { onSelect: (time: string) => void; disabled?: boolean };

function timeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function MedicineTimePicker({ onSelect, disabled }: Props) {
  const [value, setValue] = useState(() => new Date());
  const [visible, setVisible] = useState(false);

  const open = () => {
    if (disabled) return;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode: "time",
        display: "clock",
        onValueChange: (_, selected) => {
          setValue(selected);
          onSelect(timeValue(selected));
        },
      });
    } else {
      setVisible(true);
    }
  };

  return (
    <>
      <PrimaryButton testID="medicine-time-select" label="Choose another time" icon="time-outline" variant="secondary" disabled={disabled} onPress={open} />
      {Platform.OS === "ios" ? (
        <BottomSheet visible={visible} onClose={() => setVisible(false)} title="Reminder time" scrollable={false} footer={
          <PrimaryButton testID="medicine-time-confirm" label="Add time" onPress={() => {
            onSelect(timeValue(value));
            setVisible(false);
          }} />
        }>
          <DateTimePicker testID="medicine-time-picker" value={value} mode="time" display="spinner" onValueChange={(_, selected) => setValue(selected)} />
        </BottomSheet>
      ) : null}
    </>
  );
}
