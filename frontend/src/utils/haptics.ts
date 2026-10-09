import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { hapticsEnabled } from "./haptic-preference";

function fire(action: () => Promise<void>) {
  if (Platform.OS === "web" || !hapticsEnabled()) return;
  try { void action().catch(() => {}); } catch { /* Device feedback is optional. */ }
}
export const tabSwitch = () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
export const press = () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
export const lightPress = () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const success = () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const warning = () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const error = () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
