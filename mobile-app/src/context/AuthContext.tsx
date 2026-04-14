import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, organizationCode: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
    return Promise.race([
      promise,
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  };

  const checkAuth = async () => {
    try {
      const storedUser = await withTimeout(
        authService.getStoredUser(),
        AUTH_BOOTSTRAP_TIMEOUT_MS
      );

      if (storedUser) {
        // Verify token is still valid, but never block startup forever on network.
        const currentUser = await withTimeout(
          authService.getCurrentUser(),
          AUTH_BOOTSTRAP_TIMEOUT_MS
        );
        setUser(currentUser || storedUser);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, organizationCode: string, password: string) => {
    const response = await authService.login({ email, organizationCode, password });
    setUser(response.user);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    const currentUser = await authService.getCurrentUser();
    if (currentUser) {
      await authService.persistUser(currentUser);
      setUser(currentUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

