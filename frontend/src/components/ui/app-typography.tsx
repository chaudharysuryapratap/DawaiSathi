import { createContext, forwardRef, useContext } from "react";
import { Text as NativeText, TextInput as NativeInput, StyleSheet, useWindowDimensions, type TextProps, type TextInputProps } from "react-native";
import { useTextMultiplier } from "@/src/utils/text-size";
const InsideText = createContext(false);
function scaledStyle(style: TextProps["style"], multiplier: number, nested = false) {
    const flat = StyleSheet.flatten(style);
    return multiplier === 1 ? undefined : { ...(flat?.fontSize || !nested ? { fontSize: (flat?.fontSize ?? 14) * multiplier } : {}), ...(flat?.lineHeight ? { lineHeight: flat.lineHeight * multiplier } : {}) };
}
export const Text = forwardRef<NativeText, TextProps>(function AppText({ style, maxFontSizeMultiplier, children, ...props }, ref) {
    const multiplier = useTextMultiplier();
    const nested = useContext(InsideText);
    const { fontScale } = useWindowDimensions();
    const effective = maxFontSizeMultiplier && maxFontSizeMultiplier > 0 ? Math.min(multiplier, maxFontSizeMultiplier / Math.min(fontScale, maxFontSizeMultiplier)) : multiplier;
    return <NativeText {...props} ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier} style={[style, scaledStyle(style, effective, nested)]}><InsideText.Provider value={true}>{children}</InsideText.Provider></NativeText>;
});
export const TextInput = forwardRef<NativeInput, TextInputProps>(function AppInput({ style, ...props }, ref) {
    const multiplier = useTextMultiplier();
    return <NativeInput {...props} ref={ref} style={[style, scaledStyle(style, multiplier)]}/>;
});
