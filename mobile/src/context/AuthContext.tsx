import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../lib/api';
import {
  clearSession,
  getAcademicYearId,
  getCampusId,
  getStoredUser,
  getToken,
  saveSession,
  setAcademicYearId,
  type SessionUser,
} from '../lib/session';

type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; requiresOtp: true; challengeId: string; message?: string }
  | { ok: false; error: string; wrongRole?: boolean };

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  isStudent: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyOtp: (challengeId: string, code: string) => Promise<LoginResult>;
  resendOtp: (challengeId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistAuthPayload(data: any): Promise<SessionUser> {
  const user = data.user as SessionUser;
  const campusId = data.defaultCampusId || data.campusId || user.campusId || null;
  await saveSession({
    token: data.token,
    campusId,
    academicYearId: data.academicYearId || null,
    user,
  });

  try {
    const year = await api.getActiveAcademicYear();
    if (year?.id) await setAcademicYearId(year.id);
  } catch {
    // Active year is optional at login
  }

  return user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const stored = await getStoredUser();
        if (!token || !stored) {
          setUser(null);
          return;
        }
        if (stored.role !== 'STUDENT') {
          await clearSession();
          setUser(null);
          return;
        }
        setUser(stored);
        try {
          const me = await api.getMe();
          const nextUser: SessionUser = {
            id: me.id,
            email: me.email,
            firstName: me.firstName,
            lastName: me.lastName,
            role: me.role,
            campusId: me.campusId,
            studentId: me.studentId,
            phone: me.phone,
            preferredLanguage: me.preferredLanguage,
          };
          if (nextUser.role !== 'STUDENT') {
            await clearSession();
            setUser(null);
            return;
          }
          setUser(nextUser);
          await saveSession({
            token,
            campusId: me.campusId || (await getCampusId()),
            academicYearId: await getAcademicYearId(),
            user: nextUser,
          });
        } catch {
          // Keep stored user if offline
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const finishLogin = useCallback(async (data: any): Promise<LoginResult> => {
    if (data.requiresOtp) {
      return {
        ok: false,
        requiresOtp: true,
        challengeId: data.challengeId,
        message: data.message,
      };
    }
    if (!data.token || !data.user) {
      return { ok: false, error: data.error || 'Login failed' };
    }
    if (data.user.role !== 'STUDENT') {
      return {
        ok: false,
        error: 'This app is for student accounts only. Please use the web portal.',
        wrongRole: true,
      };
    }
    const user = await persistAuthPayload(data);
    setUser(user);
    return { ok: true, user };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const data = await api.login(email.trim(), password);
        return finishLogin(data);
      } catch (err: any) {
        return { ok: false, error: err.message || 'Login failed' };
      }
    },
    [finishLogin],
  );

  const verifyOtp = useCallback(
    async (challengeId: string, code: string): Promise<LoginResult> => {
      try {
        const data = await api.verifyLoginOtp(challengeId, code.trim());
        return finishLogin(data);
      } catch (err: any) {
        return { ok: false, error: err.message || 'Invalid code' };
      }
    },
    [finishLogin],
  );

  const resendOtp = useCallback(async (challengeId: string) => {
    await api.resendLoginOtp(challengeId);
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await api.getMe();
    const nextUser: SessionUser = {
      id: me.id,
      email: me.email,
      firstName: me.firstName,
      lastName: me.lastName,
      role: me.role,
      campusId: me.campusId,
      studentId: me.studentId,
      phone: me.phone,
      preferredLanguage: me.preferredLanguage,
    };
    setUser(nextUser);
    const token = await getToken();
    if (token) {
      await saveSession({
        token,
        campusId: me.campusId || (await getCampusId()),
        academicYearId: await getAcademicYearId(),
        user: nextUser,
      });
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isStudent: user?.role === 'STUDENT',
      login,
      verifyOtp,
      resendOtp,
      logout,
      refreshMe,
    }),
    [user, loading, login, verifyOtp, resendOtp, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
