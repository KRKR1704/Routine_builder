import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { api, setApiKey } from "../utils/api";

// ── Storage keys ──────────────────────────────────────────────────────────────

const KEY_USER_ID = "@routine:userId";
const KEY_API_KEY = "@routine:apiKey";
const KEY_ONBOARDING = "@routine:onboardingDone";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserState {
  userId: number | null;
  apiKey: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  onboardingDone: boolean;
  error: string | null;
  loginAsDemo: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginUser: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const UserContext = createContext<UserState>({
  userId: null,
  apiKey: null,
  isLoading: true,
  isAuthenticated: false,
  onboardingDone: false,
  error: null,
  loginAsDemo: async () => {},
  register: async () => {},
  loginUser: async () => {},
  logout: async () => {},
  completeOnboarding: async () => {},
  refresh: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);
  const [apiKeyState, setApiKeyState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const _storeCredentials = useCallback(
    async (user: { id: number; api_key: string }) => {
      setApiKey(user.api_key);
      setUserId(user.id);
      setApiKeyState(user.api_key);
      setIsAuthenticated(true);
      await AsyncStorage.multiSet([
        [KEY_USER_ID, String(user.id)],
        [KEY_API_KEY, user.api_key],
      ]);
    },
    []
  );

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [[, savedId], [, savedKey], [, savedOnboarding]] =
        await AsyncStorage.multiGet([KEY_USER_ID, KEY_API_KEY, KEY_ONBOARDING]);

      if (savedId && savedKey) {
        const id = parseInt(savedId, 10);
        setApiKey(savedKey); // arm client before validation call
        try {
          await api.users.get(id); // verify key is still valid in DB
          setUserId(id);
          setApiKeyState(savedKey);
          setIsAuthenticated(true);
          setOnboardingDone(savedOnboarding === "true");
        } catch {
          // Stale credentials (DB wiped, user deleted, etc.) — force re-login
          await AsyncStorage.multiRemove([KEY_USER_ID, KEY_API_KEY, KEY_ONBOARDING]);
          setApiKey("");
          setIsAuthenticated(false);
          setOnboardingDone(false);
        }
      } else {
        setIsAuthenticated(false);
        setOnboardingDone(false);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load session";
      setError(msg);
      console.error("[UserContext] bootstrap error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const loginAsDemo = useCallback(async () => {
    setError(null);
    const user = await api.users.demo();
    await _storeCredentials(user);
  }, [_storeCredentials]);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setError(null);
      const user = await api.auth.register(name, email, password);
      await _storeCredentials(user);
    },
    [_storeCredentials]
  );

  const loginUser = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const user = await api.auth.login(email, password);
      await _storeCredentials(user);
      // Returning users skip onboarding
      setOnboardingDone(true);
      await AsyncStorage.setItem(KEY_ONBOARDING, "true");
    },
    [_storeCredentials]
  );

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([KEY_USER_ID, KEY_API_KEY, KEY_ONBOARDING]);
    setApiKey("");
    setUserId(null);
    setApiKeyState(null);
    setIsAuthenticated(false);
    setOnboardingDone(false);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(KEY_ONBOARDING, "true");
    setOnboardingDone(true);
  }, []);

  return (
    <UserContext.Provider
      value={{
        userId,
        apiKey: apiKeyState,
        isLoading,
        isAuthenticated,
        onboardingDone,
        error,
        loginAsDemo,
        register,
        loginUser,
        logout,
        completeOnboarding,
        refresh: bootstrap,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useUser(): UserState {
  return useContext(UserContext);
}

export function useRequiredUser(): { userId: number; apiKey: string } {
  const { userId, apiKey } = useUser();
  if (!userId || !apiKey) {
    throw new Error(
      "useRequiredUser called before user was bootstrapped. Wrap in a loading guard."
    );
  }
  return { userId, apiKey };
}
