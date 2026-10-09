import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { tabSwitch } from "@/src/utils/haptics";
import { useEffect, useState, type ComponentProps } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT } from "@/src/tab-bar-metrics";
import PressableScale from "./ui/PressableScale";
import { useReduceMotion } from "./ui/useReduceMotion";

const tabs = {
  index: { label: "Today", icon: "calendar-check-outline" },
  care: { label: "Care", icon: "account-multiple-outline" },
  history: { label: "History", icon: "history" },
  settings: { label: "Settings", icon: "cog-outline" },
} as const;
type BottomTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

export function ElderlyTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      testID="bottom-tab-bar"
      style={[
        styles.bar,
        {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: 8 + insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const item = tabs[route.name as keyof typeof tabs];
        if (!item) return null;
        const selected = state.index === index;
        return (
          <TabItem
            key={route.key}
            {...item}
            selected={selected}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!selected && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() =>
              navigation.emit({ type: "tabLongPress", target: route.key })
            }
          />
        );
      })}
    </View>
  );
}

export function TabItem({
  label,
  icon,
  selected,
  onPress,
  onLongPress,
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const reduced = useReduceMotion();
  const [selection] = useState(() => new Animated.Value(selected ? 1 : 0));
  const [iconScale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) {
      iconScale.stopAnimation();
      iconScale.setValue(1);
    }
    return () => iconScale.stopAnimation();
  }, [reduced, iconScale]);
  useEffect(() => {
    selection.stopAnimation();
    if (reduced) selection.setValue(selected ? 1 : 0);
    else
      Animated.timing(selection, {
        toValue: selected ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    return () => selection.stopAnimation();
  }, [selected, reduced, selection]);
  const color = selected ? "#085041" : "#5F6B68";
  return (
    <PressableScale
      scaleTo={1}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={label}
      testID={`bottom-tab-${label.toLowerCase()}`}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        tabSwitch();
        if (!reduced)
          Animated.timing(iconScale, {
            toValue: 0.92,
            duration: 120,
            useNativeDriver: true,
          }).start();
      }}
      onPressOut={() => {
        if (!reduced)
          Animated.spring(iconScale, {
            toValue: 1,
            friction: 4,
            tension: 160,
            useNativeDriver: true,
          }).start();
      }}
      style={styles.tab}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.iconPill,
          {
            transform: [{ scale: iconScale }],
          },
        ]}
      >
      {/* Keep selection on its own native opacity layer, never mix JS color
          animation with the native press-scale animated node. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: 17, backgroundColor: "#E1F5EE", opacity: selection },
        ]}
      />
      <View style={styles.icon}>
        <MaterialCommunityIcons name={icon} size={26} color={color} />
      </View>
      </Animated.View>
      <Text
        maxFontSizeMultiplier={1.3}
        style={[styles.label, { color, fontWeight: selected ? "600" : "500" }]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingTop: 6,
    paddingHorizontal: 6,
    flexDirection: "row",
    gap: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    borderRadius: 12,
    paddingTop: 2,
    paddingBottom: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconPill: {
    width: 60,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { width: 26, height: 26 },
  label: { fontSize: 13, lineHeight: 16, textAlign: "center", flexShrink: 0 },
});
