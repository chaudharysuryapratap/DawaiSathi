import { Ionicons } from "@expo/vector-icons";
import PressableScale from "./ui/PressableScale";
import { makeStyles, useTheme } from "@/src/theme";

export function RoundBackButton({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return <PressableScale scaleTo={0.88} accessibilityLabel="Back" disabled={disabled} onPress={onPress} style={styles.button}>
    <Ionicons name="arrow-back" size={24} color={colors.onSurface}/>
  </PressableScale>;
}

const useStyles = makeStyles(colors => ({
  button: { minWidth: 48, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
}));
