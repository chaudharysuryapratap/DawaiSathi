import { Ionicons } from "@expo/vector-icons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { useTheme } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";

export default function TabsLayout() {
  const { colors } = useTheme();
  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="calendar" />
          <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="medicines">
          <NativeTabs.Trigger.Icon sf="pill.fill" />
          <NativeTabs.Trigger.Label>Medicines</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="history">
          <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" />
          <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="medicines" options={{ title: "Medicines", tabBarIcon: ({ color, size }) => <Ionicons name="medical-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: "History", tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}