import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [defaultCampusId, setDefaultCampusId] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [roleLabel, setRoleLabel] = useState('');
  const [loading, setLoading] = useState(true);

  const applyAuthData = (data) => {
    setUser(data.user);
    setCampuses(data.campuses || []);
    setDefaultCampusId(data.defaultCampusId || null);
    setPermissions(data.permissions);
    setRoleLabel(data.roleLabel);
  };

  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      applyAuthData(data);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('campusId');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem('token', data.token);
    if (data.user?.preferredLanguage) {
      localStorage.setItem('laracine_lang', data.user.preferredLanguage);
    }
    applyAuthData(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('campusId');
    setUser(null);
    setCampuses([]);
    setDefaultCampusId(null);
    setPermissions([]);
    setRoleLabel('');
  };

  const refreshUser = async () => {
    const data = await api.getMe();
    applyAuthData(data);
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        campuses,
        defaultCampusId,
        permissions,
        roleLabel,
        loading,
        login,
        logout,
        refreshUser,
        hasPermission: (p) => permissions.includes(p),
        isManager: user?.role === 'SCHOOL_MANAGER',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
