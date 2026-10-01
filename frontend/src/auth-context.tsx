import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, setAccessToken } from "./api";
import type { Account } from "./types";
import { storage } from "./utils/storage";

export const AUTH_TOKEN_KEY = "dawaisathi:authToken";

type AuthState = {
  status: "loading" | "signedOut" | "signedIn" | "error";
  user: Account | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    bootstrap_token?: string;
    invitation_token?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
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
            await storage.secureRemove(AUTH_TOKEN_KEY);
          } catch (removeError) {
            setError(
              removeError instanceof Error
                ? removeError.message
                : "Could not remove the expired saved sign-in.",
            );
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
        setError(restoreError instanceof Error ? restoreError.message : "Could not restore your session.");
        setStatus("error");
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [restoreGeneration]);

  const saveSession = useCallback(async (session: { access_token: string; user: Account }) => {
    if (!session.access_token || !session.user) {
      throw new Error("The server returned an incomplete sign-in response. Try again.");
    }
    const saved = await storage.secureSet(AUTH_TOKEN_KEY, session.access_token);
    if (!saved) {
      throw new Error("Secure storage did not confirm that the sign-in was saved. Try again.");
    }
    setAccessToken(session.access_token);
    setUser(session.user);
    setError(null);
    setStatus("signedIn");
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await saveSession(await api.login(email, password));
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : "Could not sign in.";
      setError(message);
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
    setError(null);
    try {
      await saveSession(await api.register(input));
    } catch (registerError) {
      const message = registerError instanceof Error ? registerError.message : "Could not create the account.";
      setError(message);
      throw registerError;
    }
  }, [saveSession]);

  const logout = useCallback(async () => {
    const removed = await storage.secureRemove(AUTH_TOKEN_KEY);
    if (!removed) throw new Error("Secure storage did not confirm that the saved sign-in was removed.");
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

  const value = useMemo(
    () => ({ status, user, error, login, register, logout, retry }),
    [status, user, error, login, register, logout, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
