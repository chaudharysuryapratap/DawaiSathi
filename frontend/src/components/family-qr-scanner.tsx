import PressableScale from "@/src/components/ui/PressableScale";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { familyCodeFromQr } from "@/src/family-code";
import { useTheme } from "@/src/theme";

export function FamilyQrScanner({ onScan, onCancel }: { onScan: (code: string) => void; onCancel: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState("");
  const handled = useRef(false);
  const { colors } = useTheme();
  return <View style={{ gap: 16 }}>
    <Text style={{ color: colors.muted }}>Scan a DawaiSathi family QR. Review the code before joining.</Text>
    {permission?.granted ? <CameraView style={{ height: 280, borderRadius: 16, overflow: "hidden" }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => {
      if (handled.current) return;
      const code = familyCodeFromQr(data);
      if (!code) { setError("This is not a valid DawaiSathi family QR."); return; }
      handled.current = true; onScan(code);
    }} /> : <PressableScale accessibilityRole="button" onPress={() => { void (permission?.canAskAgain === false ? Linking.openSettings() : requestPermission()); }} style={{ padding: 16, borderRadius: 12, backgroundColor: colors.brandTertiary }}><Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{permission?.canAskAgain === false ? "Open camera settings" : "Allow camera access"}</Text></PressableScale>}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
    <PressableScale accessibilityRole="button" onPress={onCancel} style={{ padding: 14 }}><Text style={{ color: colors.brandPrimary, textAlign: "center" }}>Back to family code</Text></PressableScale>
  </View>;
}
