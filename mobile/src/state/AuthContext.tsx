import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, tokenStore, unwrap } from '../lib/api';
import type { ApiResponse, User } from '../types';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const token = await tokenStore.getAccess();
      if (token) {
        const res = await api.get<ApiResponse<User>>('/auth/me');
        setUser(unwrap(res));
      } else {
        setUser(null);
      }
    } catch {
      await tokenStore.clear().catch(() => {});
      setUser(null);
    } finally {
      // Must run even if SecureStore itself throws, or the app sticks on the
      // loading gate in (app)/_layout forever.
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void loadMe();
    (globalThis as unknown as { __suretechSignedOut?: () => void }).__suretechSignedOut = () => {
      setUser(null);
    };
    return () => {
      delete (globalThis as unknown as { __suretechSignedOut?: () => void }).__suretechSignedOut;
    };
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<
      ApiResponse<{ accessToken: string; refreshToken: string; user: User }>
    >('/auth/login', { email, password });
    const data = unwrap(res);
    await tokenStore.set(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    void tokenStore.clear();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => user?.permissions?.includes(permission) ?? false,
    [user],
  );

  const value = useMemo(
    () => ({ user, ready, login, logout, hasPermission }),
    [user, ready, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
