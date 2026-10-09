import { Ionicons } from "@expo/vector-icons";
import { Children } from "react";
import { StyleSheet, Text, View } from "react-native";
import PressableScale from "./ui/PressableScale";
import { press } from "@/src/utils/haptics";
export function SettingsGroup({ title, children }: {
    title?: string;
    children: React.ReactNode;
}) {
    return <View style={{ gap: 8 }}>{title && <Text style={settingsStyles.heading}>{title}</Text>}<View style={settingsStyles.group}>{Children.toArray(children).map((child, index) => <View key={index}>{index > 0 && <View style={settingsStyles.divider}/>}{child}</View>)}</View></View>;
}
export function SettingsRow({ icon, label, helper, onPress, children, prominent = false }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    helper?: string;
    onPress?: () => void;
    children?: React.ReactNode;
    prominent?: boolean;
}) {
    const content = <><View style={settingsStyles.tile}><Ionicons name={icon} size={24} color="#0F766E"/></View><View style={{ flex: 1, gap: 4 }}><Text style={settingsStyles.label}>{label}</Text>{helper && <Text style={settingsStyles.helper}>{helper}</Text>}</View>{children ?? (onPress && <Ionicons name="chevron-forward" size={20} color="#5F6B68"/>)}</>;
    const rowStyle = [settingsStyles.row, prominent && settingsStyles.profileRow];
    return onPress ? <PressableScale haptic={false} scaleTo={1} onPressIn={press} accessibilityLabel={label} onPress={onPress} style={rowStyle}>{content}</PressableScale> : <View style={rowStyle}>{content}</View>;
}
export function SettingsToggle({ label, value, onChange, disabled = false }: {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
}) {
    return <PressableScale disabled={disabled} haptic={false} scaleTo={0.94} onPressIn={press} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} aria-checked={value} onPress={() => onChange(!value)} style={settingsStyles.toggleArea}>
    <Text style={settingsStyles.state}>{value ? "On" : "Off"}</Text>
    <View style={[settingsStyles.track, { backgroundColor: value ? "#0F766E" : "#697874" }]}><View style={[settingsStyles.thumb, { alignSelf: value ? "flex-end" : "flex-start" }]}/></View>
  </PressableScale>;
}
export const settingsStyles = StyleSheet.create({
    title: { fontSize: 26, fontWeight: "700", color: "#0F1B1A" },
    heading: { fontSize: 15, fontWeight: "500", color: "#5F7570", marginTop: 4, marginLeft: 4 },
    group: { borderRadius: 20, overflow: "hidden", backgroundColor: "#ECF8F5" },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#D7EAE3", marginHorizontal: 16 },
    row: { minHeight: 72, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", gap: 16, alignItems: "center", flexWrap: "wrap" },
    profileRow: { minHeight: 84, paddingVertical: 16 },
    tile: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#E1F5EE", alignItems: "center", justifyContent: "center" },
    label: { fontSize: 17, fontWeight: "500", color: "#0F1B1A", flexShrink: 1 },
    helper: { fontSize: 14, color: "#5F6B68" },
    toggleArea: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
    state: { fontSize: 13, color: "#5F6B68" },
    track: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: "center" },
    thumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF" },
    button: { minHeight: 56, borderRadius: 14, backgroundColor: "#0F766E", padding: 14, alignItems: "center", justifyContent: "center" },
    buttonText: { fontSize: 17, fontWeight: "500", color: "#FFFFFF", textAlign: "center" },
    outline: { borderWidth: 1, borderColor: "#697874", backgroundColor: "transparent" },
    outlineText: { color: "#334744" },
    softButton: { backgroundColor: "#ECF8F5", borderRadius: 20, borderWidth: 0 },
    softButtonText: { color: "#085041", fontWeight: "600" },
    input: { minHeight: 56, borderWidth: 1, borderColor: "#B8C8C4", borderRadius: 12, padding: 14, fontSize: 17, color: "#0F1B1A" },
    warning: { color: "#775006", backgroundColor: "#FFF5DB", padding: 14, borderRadius: 12, fontSize: 14 },
    error: { color: "#BA1A1A", fontSize: 14 },
});
export function SettingsButton({ label, onPress, outline = false, disabled = false, soft = false }: {
    label: string;
    onPress: () => void;
    outline?: boolean;
    disabled?: boolean;
    soft?: boolean;
}) {
    return <PressableScale accessibilityLabel={label} disabled={disabled} onPress={event => { event.stopPropagation(); onPress(); }} style={[settingsStyles.button, outline && settingsStyles.outline, soft && settingsStyles.softButton, disabled && { opacity: 0.5 }]}><Text style={[settingsStyles.buttonText, outline && settingsStyles.outlineText, soft && settingsStyles.softButtonText]}>{label}</Text></PressableScale>;
}
