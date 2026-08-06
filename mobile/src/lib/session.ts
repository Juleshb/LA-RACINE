import * as SecureStore from 'expo-secure-store';

const KEYS = {
  token: 'laracine_token',
  campusId: 'laracine_campusId',
  academicYearId: 'laracine_academicYearId',
  user: 'laracine_user',
} as const;

export type SessionUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  campusId?: string | null;
  studentId?: string | null;
  phone?: string | null;
  preferredLanguage?: string | null;
};

export async function getToken() {
  return SecureStore.getItemAsync(KEYS.token);
}

export async function getCampusId() {
  return SecureStore.getItemAsync(KEYS.campusId);
}

export async function getAcademicYearId() {
  return SecureStore.getItemAsync(KEYS.academicYearId);
}

export async function getStoredUser(): Promise<SessionUser | null> {
  const raw = await SecureStore.getItemAsync(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function saveSession(params: {
  token: string;
  campusId?: string | null;
  academicYearId?: string | null;
  user: SessionUser;
}) {
  await SecureStore.setItemAsync(KEYS.token, params.token);
  await SecureStore.setItemAsync(KEYS.user, JSON.stringify(params.user));
  if (params.campusId) {
    await SecureStore.setItemAsync(KEYS.campusId, params.campusId);
  } else {
    await SecureStore.deleteItemAsync(KEYS.campusId);
  }
  if (params.academicYearId) {
    await SecureStore.setItemAsync(KEYS.academicYearId, params.academicYearId);
  } else {
    await SecureStore.deleteItemAsync(KEYS.academicYearId);
  }
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.token),
    SecureStore.deleteItemAsync(KEYS.campusId),
    SecureStore.deleteItemAsync(KEYS.academicYearId),
    SecureStore.deleteItemAsync(KEYS.user),
  ]);
}

export async function setCampusId(campusId: string) {
  await SecureStore.setItemAsync(KEYS.campusId, campusId);
}

export async function setAcademicYearId(yearId: string | null) {
  if (yearId) await SecureStore.setItemAsync(KEYS.academicYearId, yearId);
  else await SecureStore.deleteItemAsync(KEYS.academicYearId);
}
