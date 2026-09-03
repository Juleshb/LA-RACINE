import { getApiBase } from './config';
import { trackedFetch } from './apiLoading';

const API_BASE = getApiBase();

function getToken() {
  return localStorage.getItem('token');
}

function getCampusId() {
  return localStorage.getItem('campusId');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const campusId = getCampusId();
  const { headers: customHeaders = {}, silent = false, ...restOptions } = options;
  const needsCampus = !endpoint.startsWith('/auth')
    && !endpoint.startsWith('/campuses')
    && !endpoint.startsWith('/users')
    && !endpoint.startsWith('/school')
    && !endpoint.startsWith('/website')
    && !endpoint.startsWith('/public')
    && !endpoint.startsWith('/verify')
    && !endpoint.startsWith('/health');

  const needsYear = needsCampus
    && !endpoint.startsWith('/academic-years');

  // Merge headers AFTER base auth/campus headers. Spreading `...options` last
  // used to overwrite Authorization and caused false "Session expired" on import.
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(needsCampus && campusId ? { 'X-Campus-Id': campusId } : {}),
    ...(needsYear && getAcademicYearId() ? { 'X-Academic-Year-Id': getAcademicYearId() } : {}),
    ...customHeaders,
  };

  // Allow callers to drop year context (e.g. fetch another campus's active year)
  if (
    Object.prototype.hasOwnProperty.call(customHeaders, 'X-Academic-Year-Id')
    && (customHeaders['X-Academic-Year-Id'] == null || customHeaders['X-Academic-Year-Id'] === '')
  ) {
    delete headers['X-Academic-Year-Id'];
  }

  const res = await trackedFetch(`${API_BASE}${endpoint}`, {
    ...restOptions,
    headers,
  }, { silent });

  if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/forgot')) {
    localStorage.removeItem('token');
    localStorage.removeItem('campusId');
    localStorage.removeItem('academicYearId');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getPublicSchool: () => request('/public/school'),
  getPublicSite: (locale = 'en') => request(`/public/site?locale=${encodeURIComponent(locale)}`),
  getPublicRegistrationOptions: (campusId) =>
    request(`/public/registration/options?campusId=${encodeURIComponent(campusId)}`),
  submitPublicRegistration: (data) =>
    request('/public/registration', { method: 'POST', body: JSON.stringify(data) }),

  getWebsiteMeta: () => request('/website/meta'),
  getWebsiteStats: () => request('/website/stats'),
  listWebsiteContent: () => request('/website'),
  getWebsitePage: (slug, locale) => request(`/website/${slug}/${locale}`),
  saveWebsitePage: (slug, locale, data) =>
    request(`/website/${slug}/${locale}`, { method: 'PUT', body: JSON.stringify({ data }) }),
  resetWebsitePage: (slug, locale) =>
    request(`/website/${slug}/${locale}/reset`, { method: 'POST', body: JSON.stringify({}) }),
  copyWebsitePage: (slug, locale, fromLocale) =>
    request(`/website/${slug}/${locale}/copy-from/${fromLocale}`, { method: 'POST', body: JSON.stringify({}) }),
  uploadCalendarPdf: (fileName, contentBase64) =>
    request('/website/upload-calendar', {
      method: 'POST',
      body: JSON.stringify({ fileName, contentBase64 }),
    }),

  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  verifyLoginOtp: (challengeId, code) =>
    request('/auth/login/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId, code }) }),
  resendLoginOtp: (challengeId) =>
    request('/auth/login/resend-otp', { method: 'POST', body: JSON.stringify({ challengeId }) }),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password, confirmPassword) =>
    request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, confirmPassword }),
    }),
  getMe: () => request('/auth/me'),
  updateMe: (data) => request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  getMyPhotoUrl: async () => {
    const token = getToken();
    const res = await trackedFetch(`${API_BASE}/auth/me/photo`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }, { silent: true });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },
  changePassword: (currentPassword, newPassword, confirmPassword) =>
    request('/auth/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    }),
  getRoles: () => request('/auth/roles'),

  getCampuses: () => request('/campuses'),
  getCampus: (id) => request(`/campuses/${id}`),
  createCampus: (data) => request('/campuses', { method: 'POST', body: JSON.stringify(data) }),
  updateCampus: (id, data) => request(`/campuses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCampus: (id) => request(`/campuses/${id}`, { method: 'DELETE' }),
  toggleCampusStatus: (id, isActive) =>
    request(`/campuses/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),

  getAcademicYears: () => request('/academic-years'),
  /** Fetch years for a specific campus (managers importing across A/B). */
  getAcademicYearsForCampus: (campusId) =>
    request('/academic-years', { headers: { 'X-Campus-Id': campusId } }),
  getActiveAcademicYear: () => request('/academic-years/active'),
  createAcademicYear: (data) => request('/academic-years', { method: 'POST', body: JSON.stringify(data) }),
  startNewAcademicYear: (data) => request('/academic-years/start-new', { method: 'POST', body: JSON.stringify(data) }),
  getCopyPreview: (yearId) => request(`/academic-years/${yearId}/copy-preview`),
  getDeliberation: (sourceYearId) =>
    request(`/academic-years/deliberation${sourceYearId ? `?sourceYearId=${encodeURIComponent(sourceYearId)}` : ''}`),
  applyDeliberation: (data) => request('/academic-years/deliberation', { method: 'POST', body: JSON.stringify(data) }),
  activateAcademicYear: (id) => request(`/academic-years/${id}/activate`, { method: 'PATCH' }),
  revertAcademicYear: (id) => request(`/academic-years/${id}/revert`, { method: 'POST' }),
  closeAcademicYear: (id) => request(`/academic-years/${id}/close`, { method: 'PATCH' }),

  getUsers: (campusId) => request(campusId ? `/users?campusId=${campusId}` : '/users'),
  getUserPhotoUrl: async (userId) => {
    const token = getToken();
    const res = await trackedFetch(`${API_BASE}/users/${userId}/photo`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }, { silent: true });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },
  getParents: (campusId) => request(campusId ? `/users/parents?campusId=${campusId}` : '/users/parents'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleUserStatus: (id, isActive) =>
    request(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  resetUserPassword: (id, password) =>
    request(`/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),
  sendUserPasswordReset: (id) =>
    request(`/users/${id}/send-password-reset`, { method: 'POST', body: JSON.stringify({}) }),
  getUserPasswordReset: (id) => request(`/users/${id}/password-reset`),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  getSchool: () => request('/school'),
  updateSchool: (id, data) => request(`/school/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getSecuritySettings: () => request('/settings/security'),
  updateSecuritySettings: (data) =>
    request('/settings/security', { method: 'PUT', body: JSON.stringify(data) }),

  getStudents: (params = {}) => {
    const q = new URLSearchParams();
    if (params.classId) q.set('classId', params.classId);
    if (params.status) q.set('status', params.status);
    const qs = q.toString();
    return request(qs ? `/students?${qs}` : '/students');
  },
  getStudent: (id) => request(`/students/${id}`),
  getStudentPhotoUrl: async (studentId) => {
    const token = getToken();
    const campusId = getCampusId();
    const res = await trackedFetch(`${API_BASE}/students/${studentId}/photo`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...(getAcademicYearId() ? { 'X-Academic-Year-Id': getAcademicYearId() } : {}),
      },
    }, { silent: true });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },
  getStudentDocumentBlob: async (studentId, docId, { download = false } = {}) => {
    const token = getToken();
    const campusId = getCampusId();
    const qs = download ? '?download=1' : '';
    const res = await trackedFetch(`${API_BASE}/students/${studentId}/documents/${docId}${qs}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...(getAcademicYearId() ? { 'X-Academic-Year-Id': getAcademicYearId() } : {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Could not load document' }));
      throw new Error(err.error || 'Could not load document');
    }
    const blob = await res.blob();
    const contentType = res.headers.get('Content-Type') || blob.type || '';
    return { blob, url: URL.createObjectURL(blob), contentType };
  },
  registerStudent: (data) => request('/students/register', { method: 'POST', body: JSON.stringify(data) }),
  registerStudentsBulk: (students, defaultStatus = 'APPROVED', { skipDuplicates = true } = {}) =>
    request('/students/register-bulk', {
      method: 'POST',
      body: JSON.stringify({ students, defaultStatus, skipDuplicates }),
    }),
  checkStudentImportDuplicates: (students) =>
    request('/students/check-duplicates', {
      method: 'POST',
      body: JSON.stringify({ students }),
    }),
  updateRegistrationStatus: (id, status) =>
    request(`/students/${id}/registration-status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getStudentAccountSuggestions: (id) => request(`/students/${id}/account-suggestions`),
  provisionStudentFamilyAccounts: (id, data) =>
    request(`/students/${id}/provision-accounts`, { method: 'POST', body: JSON.stringify(data) }),
  getRegistrationOptions: () => request('/students/registration/options'),
  createStudent: (data) => request('/students', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (id, data) => request(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  transferStudent: (id, data) => request(`/students/${id}/transfer`, { method: 'POST', body: JSON.stringify(data) }),
  changeStudentClass: (id, data) => request(`/students/${id}/change-class`, { method: 'POST', body: JSON.stringify(data) }),
  getStudentTransferDestinations: () => request('/students/transfer-destinations'),
  deleteStudent: (id, { challengeId, code } = {}) =>
    request(`/students/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ challengeId, code }),
    }),
  requestDeleteStudentOtp: (id) =>
    request(`/students/${id}/request-delete-otp`, { method: 'POST', body: JSON.stringify({}) }),
  uploadStudentDocument: (id, data) =>
    request(`/students/${id}/documents`, { method: 'POST', body: JSON.stringify(data) }),
  deleteStudentDocument: (id, docId) =>
    request(`/students/${id}/documents/${docId}`, { method: 'DELETE' }),

  getTeachers: () => request('/teachers'),
  getTeacher: (id) => request(`/teachers/${id}`),
  getTeacherPhotoUrl: async (teacherId) => {
    const token = getToken();
    const campusId = getCampusId();
    const res = await trackedFetch(`${API_BASE}/teachers/${teacherId}/photo`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...(getAcademicYearId() ? { 'X-Academic-Year-Id': getAcademicYearId() } : {}),
      },
    }, { silent: true });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },
  createTeacher: (data) => request('/teachers', { method: 'POST', body: JSON.stringify(data) }),
  updateTeacher: (id, data) => request(`/teachers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  uploadTeacherPhoto: (id, data) =>
    request(`/teachers/${id}/photo`, { method: 'POST', body: JSON.stringify(data) }),
  deleteTeacherPhoto: (id) => request(`/teachers/${id}/photo`, { method: 'DELETE' }),
  deleteTeacher: (id) => request(`/teachers/${id}`, { method: 'DELETE' }),

  getClasses: (params = {}) => {
    const q = new URLSearchParams();
    if (params.allYears) q.set('allYears', '1');
    const qs = q.toString();
    return request(qs ? `/classes?${qs}` : '/classes');
  },
  getClassesForCampus: (campusId, params = {}) => {
    const q = new URLSearchParams();
    if (params.allYears) q.set('allYears', '1');
    const qs = q.toString();
    return request(qs ? `/classes?${qs}` : '/classes', {
      headers: {
        'X-Campus-Id': campusId,
        // Drop current campus year so server uses this campus's active year
        'X-Academic-Year-Id': '',
      },
    });
  },
  getClass: (id) => request(`/classes/${id}`),
  getBulletinPresets: () => request('/classes/bulletin-presets'),
  getClassBulletinConfig: (classId) => request(`/classes/${classId}/bulletin-config`),
  updateClassBulletinConfig: (classId, data) =>
    request(`/classes/${classId}/bulletin-config`, { method: 'PATCH', body: JSON.stringify(data) }),
  createClass: (data) => request('/classes', { method: 'POST', body: JSON.stringify(data) }),
  updateClass: (id, data) => request(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClass: (id) => request(`/classes/${id}`, { method: 'DELETE' }),

  getCourses: (classId) => request(classId ? `/courses?classId=${classId}` : '/courses'),
  getCourseCurricula: () => request('/courses/curricula/templates'),
  applyCourseCurriculum: (classId, grade) =>
    request('/courses/apply-curriculum', { method: 'POST', body: JSON.stringify({ classId, grade }) }),
  applyCourseCurriculumAll: () =>
    request('/courses/apply-curriculum-all', { method: 'POST', body: JSON.stringify({}) }),
  getCurriculumForGrade: (grade) => request(`/courses/curricula/${grade}`),
  getCourse: (id) => request(`/courses/${id}`),
  createCourse: (data) => request('/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCourse: (id, data) => request(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCourse: (id) => request(`/courses/${id}`, { method: 'DELETE' }),

  getMarkAssessments: (subjectId, term) => {
    const params = new URLSearchParams({ subjectId });
    if (term) params.set('term', term);
    return request(`/marks/assessments?${params}`);
  },
  getSubjectTests: (subjectId) => {
    const params = new URLSearchParams({ subjectId });
    return request(`/marks/subject-tests?${params}`);
  },
  saveSubjectTests: (data) => request('/marks/subject-tests', { method: 'PUT', body: JSON.stringify(data) }),
  getMarks: (classId, subjectId, term, assessment, catNumber) => {
    const params = new URLSearchParams({ classId, subjectId });
    if (term) params.set('term', term);
    if (assessment) params.set('assessment', assessment);
    if (catNumber !== undefined && catNumber !== null) params.set('catNumber', String(catNumber));
    return request(`/marks?${params}`);
  },
  getMarksStats: () => request('/marks/stats'),
  saveMarks: (data) => request('/marks/bulk', { method: 'POST', body: JSON.stringify(data) }),
  getMidtermWindows: (term) => {
    const q = new URLSearchParams();
    if (term) q.set('term', term);
    return request(`/midterms/windows?${q}`);
  },
  updateMidtermWindow: (id, data) =>
    request(`/midterms/windows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  publishMidtermWindow: (id, data = {}) =>
    request(`/midterms/windows/${id}/publish`, { method: 'POST', body: JSON.stringify(data) }),
  getMidtermReport: (windowId, classId) => {
    const q = new URLSearchParams({ classId });
    return request(`/midterms/windows/${windowId}/report?${q}`);
  },
  getMidtermStudent: (windowId, studentId) =>
    request(`/midterms/windows/${windowId}/students/${studentId}`),
  getCompetenceMarks: (classId, term) => {
    const params = new URLSearchParams({ classId });
    if (term) params.set('term', term);
    return request(`/marks/competence?${params}`);
  },
  saveCompetenceMarks: (data) =>
    request('/marks/competence/bulk', { method: 'PUT', body: JSON.stringify(data) }),
  getBulletinReport: (classId, studentId, term) => {
    const params = new URLSearchParams({ classId, studentId });
    if (term) params.set('term', term);
    return request(`/marks/report?${params}`);
  },
  deleteMark: (id) => request(`/marks/${id}`, { method: 'DELETE' }),

  getAttendance: (date, classId) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (classId) params.set('classId', classId);
    return request(`/attendance?${params}`);
  },
  saveAttendance: (data) => request('/attendance/bulk', { method: 'POST', body: JSON.stringify(data) }),
  getAttendanceStats: () => request('/attendance/stats'),

  getFees: () => request('/fees'),
  getFee: (id) => request(`/fees/${id}`),
  getFeeStats: () => request('/fees/stats'),
  getConfirmationQueue: () => request('/fees/confirmation-queue'),
  sendFeeReminders: (data) => request('/fees/reminders', { method: 'POST', body: JSON.stringify(data) }),
  getFeeStructures: () => request('/fees/structures'),
  createFeeStructure: (data) => request('/fees/structures', { method: 'POST', body: JSON.stringify(data) }),
  updateFeeStructure: (id, data) => request(`/fees/structures/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFeeStructure: (id) => request(`/fees/structures/${id}`, { method: 'DELETE' }),
  generateFeesFromStructure: (id, data = {}) => request(`/fees/structures/${id}/generate`, { method: 'POST', body: JSON.stringify(data) }),
  getCashReport: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/fees/cash-report${q ? `?${q}` : ''}`);
  },
  getDebtors: () => request('/fees/debtors'),
  getTransportUnpaidFees: () => request('/fees/transport-unpaid'),
  getTuitionLedger: (level = 'nursery') => request(`/fees/tuition-ledger?level=${encodeURIComponent(level)}`),
  applyFeeDiscount: (id, data) => request(`/fees/${id}/discount`, { method: 'PATCH', body: JSON.stringify(data) }),
  suggestFeeAmount: (studentId, feeType) => request(`/fees/suggest-amount?studentId=${encodeURIComponent(studentId)}&feeType=${encodeURIComponent(feeType)}`),
  createFee: (data) => request('/fees', { method: 'POST', body: JSON.stringify(data) }),
  updateFeeStatus: (id, status) => request(`/fees/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteFee: (id) => request(`/fees/${id}`, { method: 'DELETE' }),

  getBooks: () => request('/library/books'),
  createBook: (data) => request('/library/books', { method: 'POST', body: JSON.stringify(data) }),
  updateBook: (id, data) => request(`/library/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBook: (id) => request(`/library/books/${id}`, { method: 'DELETE' }),
  getLoans: () => request('/library/loans'),
  createLoan: (data) => request('/library/loans', { method: 'POST', body: JSON.stringify(data) }),
  returnLoan: (id) => request(`/library/loans/${id}/return`, { method: 'PATCH' }),
  getLibraryStats: () => request('/library/stats'),

  getELibraryItems: () => request('/e-library'),
  getELibraryItem: (id) => request(`/e-library/${id}`),
  getELibraryFileUrl: async (id) => {
    const token = getToken();
    const campusId = getCampusId();
    const res = await trackedFetch(`${API_BASE}/e-library/${id}/file`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...(getAcademicYearId() ? { 'X-Academic-Year-Id': getAcademicYearId() } : {}),
      },
    });
    if (!res.ok) throw new Error('Could not load book');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  createELibraryItem: (data) => request('/e-library', { method: 'POST', body: JSON.stringify(data) }),
  updateELibraryItem: (id, data) => request(`/e-library/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteELibraryItem: (id) => request(`/e-library/${id}`, { method: 'DELETE' }),

  getELearningCourses: (studentId) => {
    const qs = studentId ? `?studentId=${studentId}` : '';
    return request(`/e-learning/courses${qs}`);
  },
  getELearningCourse: (id, studentId) => {
    const qs = studentId ? `?studentId=${studentId}` : '';
    return request(`/e-learning/courses/${id}${qs}`);
  },
  getELearningGradesSummary: (studentId) => {
    const qs = studentId ? `?studentId=${studentId}` : '';
    return request(`/e-learning/grades/summary${qs}`);
  },
  createELearningCourse: (data) => request('/e-learning/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateELearningCourse: (id, data) => request(`/e-learning/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteELearningCourse: (id) => request(`/e-learning/courses/${id}`, { method: 'DELETE' }),
  submitELearningExercises: (courseId, answers) => request(`/e-learning/courses/${courseId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  }),

  getTimetable: (classId) => request(classId ? `/timetable?classId=${classId}` : '/timetable'),
  getMyTimetable: () => request('/timetable/mine'),
  getTimetableTemplate: (classId) => request(classId ? `/timetable/template?classId=${classId}` : '/timetable/template'),
  saveTimetableTemplate: (data) => request('/timetable/template', { method: 'PUT', body: JSON.stringify(data) }),
  resetClassTimetableTemplate: (classId) => request(`/timetable/template?classId=${classId}`, { method: 'DELETE' }),
  createTimetableSlot: (data) => request('/timetable', { method: 'POST', body: JSON.stringify(data) }),
  updateTimetableSlot: (id, data) => request(`/timetable/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTimetableSlot: (id) => request(`/timetable/${id}`, { method: 'DELETE' }),

  getHomework: (classId, studentId) => {
    const params = new URLSearchParams();
    if (classId) params.set('classId', classId);
    if (studentId) params.set('studentId', studentId);
    const qs = params.toString();
    return request(`/homework${qs ? `?${qs}` : ''}`);
  },
  getHomeworkGradesSummary: (studentId) => {
    const qs = studentId ? `?studentId=${studentId}` : '';
    return request(`/homework/grades/summary${qs}`);
  },
  getHomeworkDetail: (id, studentId) => {
    const qs = studentId ? `?studentId=${studentId}` : '';
    return request(`/homework/${id}${qs}`);
  },
  getHomeworkFileUrl: async (homeworkId, attachmentId) => {
    const token = getToken();
    const campusId = getCampusId();
    const res = await trackedFetch(`${API_BASE}/homework/${homeworkId}/attachments/${attachmentId}/file`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...(getAcademicYearId() ? { 'X-Academic-Year-Id': getAcademicYearId() } : {}),
      },
    });
    if (!res.ok) throw new Error('Could not load file');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  createHomework: (data) => request('/homework', { method: 'POST', body: JSON.stringify(data) }),
  submitHomework: (id, answers) => request(`/homework/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  deleteHomework: (id) => request(`/homework/${id}`, { method: 'DELETE' }),

  getOnlineClasses: (classId, { silent = false } = {}) => {
    const qs = classId ? `?classId=${encodeURIComponent(classId)}` : '';
    return request(`/online-classes${qs}`, { silent });
  },
  getOnlineClass: (id) => request(`/online-classes/${id}`),
  createOnlineClass: (data) => request('/online-classes', { method: 'POST', body: JSON.stringify(data) }),
  updateOnlineClass: (id, data) => request(`/online-classes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOnlineClass: (id) => request(`/online-classes/${id}`, { method: 'DELETE' }),

  getExtracurricular: (forStudentId) => {
    const q = forStudentId ? `?forStudentId=${forStudentId}` : '';
    return request(`/extracurricular${q}`);
  },
  getExtracurricularActivity: (id) => request(`/extracurricular/${id}`),
  getExtracurricularPrimaryClasses: () => request('/extracurricular/primary-classes'),
  getExtracurricularEligibleStudents: (params = {}) => {
    const q = new URLSearchParams();
    if (params.classId) q.set('classId', params.classId);
    if (params.activityId) q.set('activityId', params.activityId);
    const qs = q.toString();
    return request(`/extracurricular/eligible-students${qs ? `?${qs}` : ''}`);
  },
  createExtracurricularActivity: (data) => request('/extracurricular', { method: 'POST', body: JSON.stringify(data) }),
  updateExtracurricularActivity: (id, data) => request(`/extracurricular/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExtracurricularActivity: (id) => request(`/extracurricular/${id}`, { method: 'DELETE' }),
  enrollExtracurricular: (activityId, studentId) => request(`/extracurricular/${activityId}/enroll`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  }),
  unenrollExtracurricular: (activityId, studentId) => request(`/extracurricular/${activityId}/enroll/${studentId}`, { method: 'DELETE' }),

  getTransportOverview: () => request('/transport/overview'),
  getTransportRoutes: () => request('/transport/routes'),
  createTransportRoute: (data) => request('/transport/routes', { method: 'POST', body: JSON.stringify(data) }),
  updateTransportRoute: (id, data) => request(`/transport/routes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransportRoute: (id) => request(`/transport/routes/${id}`, { method: 'DELETE' }),
  addTransportStop: (routeId, data) => request(`/transport/routes/${routeId}/stops`, { method: 'POST', body: JSON.stringify(data) }),
  updateTransportStop: (id, data) => request(`/transport/stops/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransportStop: (id) => request(`/transport/stops/${id}`, { method: 'DELETE' }),
  getTransportVehicles: () => request('/transport/vehicles'),
  createTransportVehicle: (data) => request('/transport/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  updateTransportVehicle: (id, data) => request(`/transport/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getTransportDrivers: () => request('/transport/drivers'),
  createTransportDriver: (data) => request('/transport/drivers', { method: 'POST', body: JSON.stringify(data) }),
  updateTransportDriver: (id, data) => request(`/transport/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  createTransportSchedule: (data) => request('/transport/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateTransportSchedule: (id, data) => request(`/transport/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransportSchedule: (id) => request(`/transport/schedules/${id}`, { method: 'DELETE' }),
  getTransportPassengers: (routeId) => request(routeId ? `/transport/passengers?routeId=${routeId}` : '/transport/passengers'),
  getTransportPassengerList: (routeId) => request(`/transport/routes/${routeId}/passenger-list`),
  assignTransportPassenger: (data) => request('/transport/passengers', { method: 'POST', body: JSON.stringify(data) }),
  removeTransportPassenger: (studentId) => request(`/transport/passengers/${studentId}`, { method: 'DELETE' }),
  getTransportAttendance: (routeId, date, direction) => request(`/transport/attendance?routeId=${routeId}&date=${date}&direction=${direction}`),
  saveTransportAttendance: (data) => request('/transport/attendance', { method: 'POST', body: JSON.stringify(data) }),
  getTransportAlerts: () => request('/transport/alerts'),
  createTransportAlert: (data) => request('/transport/alerts', { method: 'POST', body: JSON.stringify(data) }),
  getMyTransport: () => request('/transport/my'),
  getTransportFees: () => request('/transport/fees'),

  getReportCatalog: () => request('/reports/catalog'),
  getReport: (type, params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== '') search.set(key, value);
    });
    const qs = search.toString();
    return request(`/reports/${type}${qs ? `?${qs}` : ''}`);
  },

  getParentChildren: () => request('/parent/children'),
  getParentDashboard: () => request('/parent/dashboard'),
  getParentRegistrationOptions: () => request('/parent/registration/options'),
  submitParentRegistration: (data) => request('/parent/registration', { method: 'POST', body: JSON.stringify(data) }),
  getParentRegistrations: () => request('/parent/registrations'),
  getParentRegistration: (id) => request(`/parent/registrations/${id}`),
  getParentChildAccounts: () => request('/parent/children/accounts'),
  getParentChildAccount: (studentId) => request(`/parent/children/${studentId}/account`),
  createParentChildAccount: (studentId, data) => request(`/parent/children/${studentId}/account`, { method: 'POST', body: JSON.stringify(data) }),
  resetParentChildPassword: (studentId, password) => request(`/parent/children/${studentId}/account/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),
  setParentChildAccountStatus: (studentId, isActive) => request(`/parent/children/${studentId}/account/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),

  getTeacherDashboard: () => request('/teacher/dashboard'),
  getStudentDashboard: () => request('/student/dashboard'),
  getStudentAiStatus: () => request('/student/ai-status'),
  getStudentAiChats: () => request('/student/ai-chats'),
  getStudentAiChat: (id) => request(`/student/ai-chats/${id}`),
  saveStudentAiChat: (data) => request('/student/ai-chats', { method: 'POST', body: JSON.stringify(data) }),
  deleteStudentAiChat: (id) => request(`/student/ai-chats/${id}`, { method: 'DELETE' }),
  streamStudentAiChat: async ({ messages }, { onChunk } = {}) => {
    const token = getToken();
    const campusId = getCampusId();
    const res = await trackedFetch(`${API_BASE}/student/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...(getAcademicYearId() ? { 'X-Academic-Year-Id': getAcademicYearId() } : {}),
      },
      body: JSON.stringify({ messages }),
    }, { silent: true });

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('campusId');
      localStorage.removeItem('academicYearId');
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'AI tutor failed' }));
      throw new Error(error.error || 'AI tutor failed');
    }

    if (!res.body) {
      throw new Error('AI tutor returned an empty response');
    }

    const reader = res.body.getReader();
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
  },
  getMyStudentPhotoUrl: async () => {
    const token = getToken();
    const campusId = getCampusId();
    const res = await trackedFetch(`${API_BASE}/student/photo`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...(getAcademicYearId() ? { 'X-Academic-Year-Id': getAcademicYearId() } : {}),
      },
    }, { silent: true });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },

  getCommunicationInbox: () => request('/communication/inbox'),
  getCommunicationUnreadCount: () => request('/communication/unread-count'),
  getCommunicationChannels: () => request('/communication/channels'),
  getCommunicationChildren: () => request('/communication/children'),
  getCommunicationBroadcasts: () => request('/communication/broadcasts'),
  createCommunicationBroadcast: (data) => request('/communication/broadcasts', { method: 'POST', body: JSON.stringify(data) }),
  markBroadcastRead: (id) => request(`/communication/broadcasts/${id}/read`, { method: 'POST' }),
  getCommunicationThreads: () => request('/communication/threads'),
  getCommunicationThread: (id) => request(`/communication/threads/${id}`),
  createCommunicationThread: (data) => request('/communication/threads', { method: 'POST', body: JSON.stringify(data) }),
  replyCommunicationThread: (id, body) => request(`/communication/threads/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  updateThreadStatus: (id, status) => request(`/communication/threads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  submitPublicContact: (data) => request('/contact', { method: 'POST', body: JSON.stringify(data) }),
  requestContactRepliesOtp: (email, locale = 'en') => request('/contact/replies/request-otp', { method: 'POST', body: JSON.stringify({ email, locale }) }),
  verifyContactRepliesOtp: (email, code) => request('/contact/replies/verify-otp', { method: 'POST', body: JSON.stringify({ email, code }) }),
  startSupportChat: (data) => request('/contact/chat/start', { method: 'POST', body: JSON.stringify(data) }),
  sendSupportChatMessage: (data) => request('/contact/chat/message', { method: 'POST', body: JSON.stringify(data) }),
  getSupportChatSession: (token) => request(`/contact/chat/session?token=${encodeURIComponent(token)}`),
  getAdminContactInquiries: () => request('/contact/admin/inquiries'),
  getAdminContactInquiry: (id) => request(`/contact/admin/inquiries/${id}`),
  replyAdminContactInquiry: (id, body) => request(`/contact/admin/inquiries/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),
  updateAdminContactInquiryStatus: (id, status) => request(`/contact/admin/inquiries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export function setActiveAcademicYear(academicYearId) {
  if (academicYearId) localStorage.setItem('academicYearId', academicYearId);
  else localStorage.removeItem('academicYearId');
}

export function getAcademicYearId() {
  return localStorage.getItem('academicYearId');
}

export function setActiveCampus(campusId) {
  const previous = localStorage.getItem('campusId');
  if (campusId) localStorage.setItem('campusId', campusId);
  else localStorage.removeItem('campusId');
  // Academic year IDs are per-campus — drop stale year when switching
  if (previous && campusId && previous !== campusId) {
    localStorage.removeItem('academicYearId');
  }
  if (!campusId) localStorage.removeItem('academicYearId');
}

export function getActiveCampus() {
  return localStorage.getItem('campusId');
}
