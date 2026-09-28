import { Stack } from "expo-router";

import { useTheme } from "@/src/theme";

export default function CareLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface, fontWeight: "800" },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
