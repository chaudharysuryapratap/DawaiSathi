import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Pressable, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { press } from "@/src/utils/haptics";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/src/theme";

const CENTER = 120;
const DATE_CARD_WIDTH = 70;
const DATE_CARD_STRIDE = DATE_CARD_WIDTH + 8;
export function localDayKey(day: Date) {
  return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
}
export function offsetDay(day: Date, offset: number) {
  const result = new Date(day); result.setHours(12, 0, 0, 0); result.setDate(result.getDate() + offset); return result;
}
export function dialIndex(offset: number, stride: number) {
  return Math.max(0, Math.round(offset / stride));
}

/** A virtual moving date window: recentering preserves the selected calendar day. */
export function HistoryDateDial({ taken, missed, onSelectDate }: { taken: Record<string, number>; missed: Record<string, number>; onSelectDate?: (date: string) => void }) {
  const { colors } = useTheme();
  const [today] = useState(() => offsetDay(new Date(), 0));
  const [daysBack, setDaysBack] = useState(CENTER);
  const [selected, setSelected] = useState(localDayKey(today));
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<Date>>(null);
  const recentering = useRef(false);
  const pendingOffset = useRef(0);
  const [scrollX] = useState(() => new Animated.Value(CENTER * DATE_CARD_STRIDE));
  const dates = useMemo(() => Array.from({ length: daysBack + 1 }, (_, index) => offsetDay(today, index - daysBack)), [daysBack, today]);
  const cardWidth = DATE_CARD_WIDTH;
  const stride = DATE_CARD_STRIDE;
  useEffect(() => {
    if (!recentering.current) return;
    scrollX.setValue(pendingOffset.current);
    list.current?.scrollToOffset({ offset: pendingOffset.current, animated: false });
    recentering.current = false;
  }, [daysBack, scrollX]);
  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (recentering.current) return;
    const index = Math.min(dates.length - 1, dialIndex(event.nativeEvent.contentOffset.x, stride));
    if (index < 20) {
      recentering.current = true;
      pendingOffset.current = (index + CENTER) * stride;
      setDaysBack(value => value + CENTER);
    }
  };
  return <View testID="history-date-dial" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 18, paddingVertical: 8 }}>
    {width > 0 && <Animated.FlatList ref={list} data={dates} horizontal initialScrollIndex={CENTER} keyExtractor={localDayKey}
      getItemLayout={(_, index) => ({ length: stride, offset: stride * index, index })}
      contentContainerStyle={{ paddingLeft: Math.max(0, (width - stride) / 2), paddingRight: 4 }}
      showsHorizontalScrollIndicator={false} snapToInterval={stride} snapToAlignment="start"
      decelerationRate="fast" disableIntervalMomentum={false}
      bounces={false} overScrollMode="never" scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
      initialNumToRender={11} maxToRenderPerBatch={11} windowSize={5}
      onMomentumScrollEnd={settle}
      onScrollEndDrag={event => { if (!event.nativeEvent.velocity?.x) settle(event); }}
      renderItem={({ item, index }) => {
        const key = localDayKey(item), active = key === selected, future = key > localDayKey(today);
        const completed = future ? 0 : taken[key] ?? 0, total = completed + (future ? 0 : missed[key] ?? 0);
        const progress = total ? completed / total : 0;
        const tint = progress >= 1 ? colors.success : progress >= 0.5 ? colors.warning : colors.error;
        const circumference = 2 * Math.PI * 16;
        const inputRange = [(index - 1) * stride, index * stride, (index + 1) * stride];
        return <Animated.View style={{ opacity: scrollX.interpolate({ inputRange, outputRange: [0.78, 1, 0.78], extrapolate: "clamp" }), transform: [{ scale: scrollX.interpolate({ inputRange, outputRange: [0.95, 1, 0.95], extrapolate: "clamp" }) }] }}><Pressable testID={"history-date-" + key} accessibilityRole="button" accessibilityState={{ selected: active }}
          accessibilityLabel={item.toDateString() + (key === localDayKey(today) ? ", Today" : "") + (future ? ", Upcoming" : total ? ", " + completed + " taken out of " + total + " recorded events" : ", No recorded events")}
          onPressIn={press}
          onPress={() => { setSelected(key); onSelectDate?.(key); list.current?.scrollToOffset({ offset: Math.min(index * stride, Math.max(0, dates.length * stride + (width - stride) / 2 + 4 - width)), animated: true }); }}
          style={{ width: cardWidth, marginHorizontal: 4, minHeight: 128, borderRadius: 14, borderWidth: 1, borderColor: active ? colors.brandPrimary : colors.divider, backgroundColor: active ? colors.brandTertiary : colors.surface, alignItems: "center", paddingVertical: 8, gap: 4 }}>
          <Text style={{ color: active ? colors.onBrandTertiary : colors.muted, fontSize: 12 }}>{item.toLocaleDateString("en-US", { weekday: "short" })}</Text>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "800" }}>{item.getDate()}</Text>
          <Text style={{ color: colors.onSurfaceSecondary, fontSize: 12 }}>{item.toLocaleDateString("en-US", { month: "short" })}</Text>
          <Svg width={34} height={34} viewBox="0 0 40 40">
            <Circle cx={20} cy={20} r={16} stroke={colors.divider} strokeWidth={5} fill="none" />
            {progress > 0 && <Circle cx={20} cy={20} r={16} stroke={tint} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={[circumference * progress, circumference]} transform="rotate(-90 20 20)" />}
          </Svg>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{future ? "Upcoming" : total ? completed + "/" + total : "—"}</Text>
        </Pressable></Animated.View>;
      }} />}
  </View>;
}
