import React, { forwardRef, useEffect, useRef, useState } from "react";
import { lightPress } from "@/src/utils/haptics";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  type PressableProps,
  type View,
} from "react-native";

export type PressableScaleProps = PressableProps & { scaleTo?: number; haptic?: boolean };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Animate the original pressable host, without adding a layout-changing wrapper. */
const PressableScale = forwardRef<View, PressableScaleProps>(
  function PressableScale(
    {
      scaleTo = 0.94,
      haptic,
      style,
      onPressIn,
      onPressOut,
      onHoverIn,
      onHoverOut,
      disabled,
      ...rest
    },
    ref,
  ) {
    const scale = useRef(new Animated.Value(1)).current;
    const reduceMotion = useRef(true);
    const [pressed, setPressed] = useState(false);
    const [hovered, setHovered] = useState(false);
    useEffect(() => {
      let mounted = true;
      const update = (enabled: boolean) => {
        if (!mounted) return;
        reduceMotion.current = enabled;
        if (enabled) {
          scale.stopAnimation();
          scale.setValue(1);
        }
      };
      const subscription = AccessibilityInfo.addEventListener(
        "reduceMotionChanged",
        update,
      );
      void AccessibilityInfo.isReduceMotionEnabled()
        .then(update)
        .catch(() => update(true));
      return () => {
        mounted = false;
        subscription.remove();
        scale.stopAnimation();
      };
    }, [scale]);
    useEffect(() => {
      if (disabled) {
        setPressed(false);
        scale.stopAnimation();
        scale.setValue(1);
      }
    }, [disabled, scale]);
    const resolvedStyle =
      typeof style === "function" ? style({ pressed, hovered }) : style;
    const existingTransform = StyleSheet.flatten(resolvedStyle)?.transform;
    return (
      <AnimatedPressable
        accessibilityRole="button"
        {...rest}
        ref={ref}
        disabled={disabled}
        style={[
          resolvedStyle,
          {
            transform: [
              ...(Array.isArray(existingTransform) ? existingTransform : []),
              { scale },
            ],
          },
        ]}
        onHoverIn={(event) => {
          setHovered(true);
          onHoverIn?.(event);
        }}
        onHoverOut={(event) => {
          setHovered(false);
          onHoverOut?.(event);
        }}
        onPressIn={(event) => {
          // Default .94 is reserved for rectangular/pill buttons. Icon controls
          // (.88), cards (.97), and tabs provide their own feedback or none.
          if (!disabled && (haptic ?? (scaleTo === 0.94 && rest.accessibilityRole !== "tab"))) lightPress();
          setPressed(true);
          if (!reduceMotion.current && !disabled) {
            scale.stopAnimation();
            Animated.timing(scale, {
              toValue: scaleTo,
              duration: 120,
              useNativeDriver: true,
            }).start();
          }
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          setPressed(false);
          if (!reduceMotion.current) {
            scale.stopAnimation();
            Animated.spring(scale, {
              toValue: 1,
              friction: 4,
              tension: 160,
              useNativeDriver: true,
            }).start();
          }
          onPressOut?.(event);
        }}
      />
    );
  },
);
export default PressableScale;
