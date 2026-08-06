import { getApiBase } from './config';
import {
  clearSession,
  getAcademicYearId,
  getCampusId,
  getToken,
} from './session';

const API_BASE = getApiBase();

type RequestOptions = RequestInit & {
  headers?: Record<string, string>;
  skipAuthRedirect?: boolean;
};

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function authHeaders(endpoint: string, customHeaders: Record<string, string> = {}) {
  const token = await getToken();
  const campusId = await getCampusId();
  const yearId = await getAcademicYearId();

  const needsCampus =
    !endpoint.startsWith('/auth') &&
    !endpoint.startsWith('/campuses') &&
    !endpoint.startsWith('/users') &&
    !endpoint.startsWith('/school') &&
    !endpoint.startsWith('/website') &&
    !endpoint.startsWith('/public') &&
    !endpoint.startsWith('/verify') &&
    !endpoint.startsWith('/health');

  const needsYear = needsCampus && !endpoint.startsWith('/academic-years');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(needsCampus && campusId ? { 'X-Campus-Id': campusId } : {}),
    ...(needsYear && yearId ? { 'X-Academic-Year-Id': yearId } : {}),
    ...customHeaders,
  };

  if (
    Object.prototype.hasOwnProperty.call(customHeaders, 'X-Academic-Year-Id') &&
    (customHeaders['X-Academic-Year-Id'] == null || customHeaders['X-Academic-Year-Id'] === '')
  ) {
    delete headers['X-Academic-Year-Id'];
  }

  return headers;
}

async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { headers: customHeaders = {}, skipAuthRedirect, ...rest } = options;
  const headers = await authHeaders(endpoint, customHeaders);

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers,
  });

  if (
    res.status === 401 &&
    !skipAuthRedirect &&
    !endpoint.includes('/auth/login') &&
    !endpoint.includes('/auth/forgot')
  ) {
    await clearSession();
    onUnauthorized?.();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuthRedirect: true,
    }),

  verifyLoginOtp: (challengeId: string, code: string) =>
    request('/auth/login/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ challengeId, code }),
      skipAuthRedirect: true,
    }),

  resendLoginOtp: (challengeId: string) =>
    request('/auth/login/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ challengeId }),
      skipAuthRedirect: true,
    }),

  getMe: () => request('/auth/me'),
  updateMe: (data: Record<string, unknown>) =>
    request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    request('/auth/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    }),

  getActiveAcademicYear: () => request('/academic-years/active'),

  getStudentDashboard: () => request('/student/dashboard'),
  getStudentAiStatus: () => request('/student/ai-status'),
  getStudentAiChats: () => request('/student/ai-chats'),
  getStudentAiChat: (id: string) => request(`/student/ai-chats/${id}`),
  saveStudentAiChat: (data: Record<string, unknown>) =>
    request('/student/ai-chats', { method: 'POST', body: JSON.stringify(data) }),
  deleteStudentAiChat: (id: string) =>
    request(`/student/ai-chats/${id}`, { method: 'DELETE' }),

  streamStudentAiChat: async (
    { messages }: { messages: { role: string; content: string }[] },
    { onChunk }: { onChunk?: (chunk: string) => void } = {},
  ) => {
    const headers = await authHeaders('/student/ai-chat');
    const res = await fetch(`${API_BASE}/student/ai-chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages }),
    });

    if (res.status === 401) {
      await clearSession();
      onUnauthorized?.();
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'AI tutor failed' }));
      throw new Error(error.error || 'AI tutor failed');
    }

    // React Native may not expose ReadableStream; fall back to text.
    if (res.body && typeof (res.body as any).getReader === 'function') {
      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        full += chunk;
        onChunk?.(chunk);
      }
      return full;
    }

    const text = await res.text();
    onChunk?.(text);
    return text;
  },

  getMyStudentPhotoSource: async () => {
    const token = await getToken();
    const campusId = await getCampusId();
    const yearId = await getAcademicYearId();
    return {
      uri: `${API_BASE}/student/photo`,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...(yearId ? { 'X-Academic-Year-Id': yearId } : {}),
      },
    };
  },

  getHomework: () => request('/homework'),
  getHomeworkGradesSummary: () => request('/homework/grades/summary'),
  getHomeworkDetail: (id: string) => request(`/homework/${id}`),
  submitHomework: (id: string, answers: { questionId: string; answer: string }[]) =>
    request(`/homework/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  getHomeworkAttachmentSource: async (homeworkId: string, attachmentId: string) => {
    const token = await getToken();
    const campusId = await getCampusId();
    const yearId = await getAcademicYearId();
    return {
      uri: `${API_BASE}/homework/${homeworkId}/attachments/${attachmentId}/file`,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...(yearId ? { 'X-Academic-Year-Id': yearId } : {}),
      },
    };
  },

  getOnlineClasses: () => request('/online-classes'),
  getOnlineClass: (id: string) => request(`/online-classes/${id}`),

  getELibraryItems: () => request('/e-library'),
  getELibraryItem: (id: string) => request(`/e-library/${id}`),
  getELibraryFileSource: async (id: string) => {
    const token = await getToken();
    const campusId = await getCampusId();
    const yearId = await getAcademicYearId();
    return {
      uri: `${API_BASE}/e-library/${id}/file`,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...(yearId ? { 'X-Academic-Year-Id': yearId } : {}),
      },
    };
  },

  getELearningCourses: () => request('/e-learning/courses'),
  getELearningCourse: (id: string) => request(`/e-learning/courses/${id}`),
  getELearningGradesSummary: () => request('/e-learning/grades/summary'),
  submitELearningExercises: (courseId: string, answers: { exerciseId: string; answer: string }[]) =>
    request(`/e-learning/courses/${courseId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
};
