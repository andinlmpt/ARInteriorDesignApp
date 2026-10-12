import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  getToken,
  setToken,
  storeApi,
  type AuthUser,
  type Store,
  type StoreRegistrationInput,
} from '../api/client';

interface AuthContextValue {
  user: AuthUser | null;
  /** The signed-in store's details (store accounts only). */
  store: Store | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerStore: (input: StoreRegistrationInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setStore: (store: Store | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const CONSOLE_ROLES = ['admin', 'store'];

/** Loads the account and, for store owners, their store. */
async function loadSession(): Promise<{ user: AuthUser; store: Store | null }> {
  const { user } = await api.getMe();
  const store = user.role === 'store' ? (await storeApi.getMyStore()).store : null;
  return { user, store };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const session = await loadSession();
    setUser(session.user);
    setStore(session.store);
  }

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }

    loadSession()
      .then((session) => {
        setUser(session.user);
        setStore(session.store);
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        setStore(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      store,
      loading,
      setUser,
      setStore,
      refreshUser,
      async login(email: string, password: string) {
        const res = await api.login(email, password);
        if (!CONSOLE_ROLES.includes(res.user.role)) {
          throw new Error('This is a customer account. Customers sign in on the mobile app.');
        }
        setToken(res.token);
        try {
          await refreshUser();
        } catch (err) {
          setToken(null);
          throw err;
        }
      },
      async registerStore(input: StoreRegistrationInput) {
        const res = await api.registerStore(input);
        setToken(res.token);
        await refreshUser();
      },
      logout() {
        setToken(null);
        setUser(null);
        setStore(null);
      },
    }),
    [user, store, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
