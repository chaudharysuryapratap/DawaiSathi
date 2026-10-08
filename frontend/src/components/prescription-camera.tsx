import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { PrimaryButton } from "./dawai-ui";

export function PrescriptionCamera({ onPhoto, onUpload }: { onPhoto: (uri: string) => Promise<void>; onUpload: () => void }) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState("");
  if (!permission?.granted) return <View style={{ padding: 20, gap: 16 }}><Text>Allow camera access to photograph your prescription.</Text><PrimaryButton label="Allow camera" onPress={() => void requestPermission()} /><PrimaryButton label="Upload instead" variant="secondary" onPress={onUpload} /></View>;
  return <View style={{ flex: 1, minHeight: 480, gap: 14, backgroundColor: "#183d38", padding: 16, borderRadius: 20 }}>
    <CameraView ref={camera} facing="back" style={{ height: 350, borderRadius: 16, overflow: "hidden" }} onCameraReady={() => setReady(true)} onMountError={() => setError("Camera could not start. Upload a photo instead.")}>
      <View pointerEvents="none" style={{ margin: 24, flex: 1, borderRadius: 12, borderWidth: 2, borderColor: "white" }} />
    </CameraView>
    <Text style={{ color: "white", fontWeight: "800", fontSize: 17 }}>Place the prescription inside the frame</Text>
    <Text style={{ color: "white", fontSize: 15 }}>Make sure the writing is clear and well lit.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: "white" }}>{error}</Text>}
    <PrimaryButton label={busy ? "Taking photo…" : "Take photo"} disabled={busy || !ready} onPress={() => { setBusy(true); setError(""); void (async () => { try { const photo = await camera.current?.takePictureAsync({ quality: .8 }); if (!photo) throw new Error("Could not take the photo."); await onPhoto(photo.uri); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } })(); }} />
    <PrimaryButton label="Upload instead" variant="secondary" onPress={onUpload} disabled={busy} />
  </View>;
}
