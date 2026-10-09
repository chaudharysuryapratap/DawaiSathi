import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, setAccessToken } from "./api";
import { AUTH_TOKEN_KEY } from "./auth-token-key";
import type { Account } from "./types";
import { getErrorMessage } from "./utils/error-message";
import { storage } from "./utils/storage";

export { AUTH_TOKEN_KEY } from "./auth-token-key";

type AuthState = {
  status: "loading" | "signedOut" | "signedIn" | "error";
  user: Account | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (input: { id_token: string; password?: string; invitation_token?: string; bootstrap_token?: string }) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    bootstrap_token?: string;
    invitation_token?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
  updateProfile: (input: { name?: string; email?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreGeneration, setRestoreGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const token = await storage.secureGet<string | null>(AUTH_TOKEN_KEY, null);
        if (cancelled) return;
        if (!token) {
          setAccessToken(null);
          setUser(null);
          setStatus("signedOut");
          return;
        }
        setAccessToken(token);
        const currentUser = await api.currentAccount();
        if (cancelled) return;
        setUser(currentUser);
        setError(null);
        setStatus("signedIn");
      } catch (restoreError) {
        if (cancelled) return;
        if (restoreError instanceof Error && "status" in restoreError && restoreError.status === 401) {
          try {
            const removed = await storage.secureRemove(AUTH_TOKEN_KEY);
            if (!removed) throw new Error("Secure storage did not confirm that the expired sign-in was removed.");
          } catch (removeError) {
            setError(getErrorMessage(removeError, "Could not remove the expired saved sign-in."));
            setUser(null);
            setAccessToken(null);
            setStatus("error");
            return;
          }
          setAccessToken(null);
          setUser(null);
          setStatus("signedOut");
          return;
        }
        setAccessToken(null);
        setUser(null);
        setError(getErrorMessage(restoreError, "Could not restore your session."));
        setStatus("error");
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [restoreGeneration]);

  const saveSession = useCallback(async (session: { access_token: string; user: Account }) => {
    if (
      typeof session.access_token !== "string" ||
      !session.access_token.trim() ||
      !session.user ||
      typeof session.user !== "object"
    ) {
      throw new Error("The server returned an incomplete sign-in response. Try again.");
    }
    try {
      const saved = await storage.secureSet(AUTH_TOKEN_KEY, session.access_token);
      if (!saved) throw new Error("Secure storage did not confirm that the sign-in was saved.");
    } catch (saveError) {
      setAccessToken(null);
      setUser(null);
      setStatus("signedOut");
      try {
        const removed = await storage.secureRemove(AUTH_TOKEN_KEY);
        if (!removed) throw new Error("Secure storage did not confirm that the saved sign-in was removed.");
      } catch {
        throw new Error(
          "Could not save the sign-in or clear saved session data. Check browser storage permissions and try again.",
        );
      }
      throw saveError;
    }
    setAccessToken(session.access_token);
    setUser(session.user);
    setError(null);
    setStatus("signedIn");
  }, []);

  const googleLogin = useCallback(async (input: { id_token: string; password?: string; invitation_token?: string; bootstrap_token?: string }) => {
    await saveSession(await api.googleLogin(input));
  }, [saveSession]);

  const login = useCallback(async (email: string, password: string) => {
    setAccessToken(null);
    setUser(null);
    setStatus("signedOut");
    setError(null);
    try {
      await saveSession(await api.login(email, password));
    } catch (loginError) {
      setAccessToken(null);
      setUser(null);
      setStatus("signedOut");
      setError(getErrorMessage(loginError, "Could not sign in."));
      throw loginError;
    }
  }, [saveSession]);

  const register = useCallback(async (input: {
    name: string;
    email: string;
    password: string;
    bootstrap_token?: string;
    invitation_token?: string;
  }) => {
    setAccessToken(null);
    setUser(null);
    setStatus("signedOut");
    setError(null);
    try {
      await saveSession(await api.register(input));
    } catch (registerError) {
      setAccessToken(null);
      setUser(null);
      setStatus("signedOut");
      setError(getErrorMessage(registerError, "Could not create the account."));
      throw registerError;
    }
  }, [saveSession]);

  const logout = useCallback(async () => {
    try {
      const removed = await storage.secureRemove(AUTH_TOKEN_KEY);
      if (!removed) throw new Error("Secure storage did not confirm that the saved sign-in was removed.");
    } catch (removeError) {
      setAccessToken(null);
      setUser(null);
      setError(
        `Signed out in this tab, but could not clear the saved sign-in: ${getErrorMessage(
          removeError,
          "browser storage is unavailable",
        )}`,
      );
      setStatus("signedOut");
      throw removeError;
    }
    setAccessToken(null);
    setUser(null);
    setError(null);
    setStatus("signedOut");
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setStatus("loading");
    setRestoreGeneration((generation) => generation + 1);
  }, []);

  const updateProfile = useCallback(async (input: { name?: string; email?: string }) => {
    setUser(await api.updateAccount(input));
  }, []);
  const value = useMemo(
    () => ({ status, user, error, login, googleLogin, register, logout, retry, updateProfile }),
    [status, user, error, login, googleLogin, register, logout, retry, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
