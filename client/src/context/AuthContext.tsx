import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('khata_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('khata_token');
      if (token) {
        try {
          const freshUser = await authService.getMe();
          setUser(freshUser);
          localStorage.setItem('khata_user', JSON.stringify(freshUser));
        } catch {
          setUser(null);
          localStorage.removeItem('khata_token');
          localStorage.removeItem('khata_user');
        }
      }
      setLoading(false);
    };
    verifyAuth();
  }, []);

  const login = async (username: string, pass: string) => {
    const res = await authService.login(username, pass);
    setUser(res.user);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions?.includes(permission) || false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
