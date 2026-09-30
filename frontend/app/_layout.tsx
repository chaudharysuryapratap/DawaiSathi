import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/src/auth-context";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { DataProvider } from "@/src/data-context";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

function AuthenticatedApp() {
  const { status } = useAuth();
  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === "signedIn"}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="care" />
        <Stack.Screen name="add-medicine" options={{ presentation: "modal" }} />
        <Stack.Screen name="add-eye-drop-protocol" options={{ presentation: "modal" }} />
        <Stack.Screen name="add-checkup" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Protected guard={status !== "signedIn"}>
        <Stack.Screen name="auth" />
      </Stack.Protected>
    </Stack>
  );
  if (status !== "signedIn") return stack;

  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardProvider>
        <DataProvider>{stack}</DataProvider>
      </KeyboardProvider>
    </QueryClientProvider>
  );
}
