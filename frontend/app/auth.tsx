import { AuthScreen } from "@/src/components/auth-screen";
import { ErrorState, LoadingState } from "@/src/components/dawai-ui";
import { useAuth } from "@/src/auth-context";

export default function AuthRoute() {
  const { status, error, retry } = useAuth();
  if (status === "loading") return <LoadingState label="Restoring secure session" />;
  if (status === "error") {
    return <ErrorState message={error ?? "Could not restore your session."} onRetry={retry} />;
  }
  return <AuthScreen />;
}
