import { forwardRef, useState } from "react";
import { Platform, TextInput as NativeInput, type TextInputProps, type TextStyle } from "react-native";
import { useTheme } from "@/src/theme";
// React Native Web supports 'none'; the native outline type does not include it.
const webFocusReset = Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : undefined;

/** Shared typing feedback without changing each field's events or layout. */
export const TextInput = forwardRef<NativeInput, TextInputProps & { focusOutline?: boolean }>(function FocusInput({ style, onFocus, onBlur, focusOutline = true, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  const { colors } = useTheme();
  return <NativeInput {...props} ref={ref} onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }} style={[
    { borderWidth: 1, borderColor: colors.divider }, style, webFocusReset,
    focused && focusOutline && { borderWidth: 1, borderColor: colors.brandPrimary, boxShadow: "0 0 0 2px rgba(19,134,125,0.12)" },
  ]} />;
});
