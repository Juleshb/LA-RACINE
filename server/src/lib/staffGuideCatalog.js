import { hasPermission } from '../config/permissions.js';
import { guideCopy, guideReply, normalizeGuideLanguage, splitGuideSteps } from './staffGuideI18n.js';

const ACTIONS = [
  {
    id: 'attendance',
    permission: 'attendance',
    path: 'attendance',
    label: 'Mark attendance',
    steps: 'Open Attendance. Choose the date and your class, set each student to present, absent, late, or excused, then save.',
    keywords: ['attendance', 'absent', 'present', 'late', 'excused', 'présence', 'absent', 'kuzaza', 'kwitabira', 'mahudhurio'],
  },
  {
    id: 'marks',
    permission: 'marks',
    path: 'marks',
    label: 'Enter marks',
    steps: 'Open Enter marks. Choose the class, course, and assessment, type each student’s mark, then save.',
    keywords: ['marks', 'score', 'notes', 'amanota', 'alama', 'saisir les notes', 'enter marks'],
  },
  {
    id: 'homework',
    permission: 'homework',
    path: 'homework',
    label: 'Give homework',
    steps: 'Open Homework. Create the assignment for your class, add the instructions, and save so students can see it.',
    keywords: ['homework', 'assignment', 'devoir', 'imirimo', 'kazi'],
  },
  {
    id: 'classes',
    permission: 'classes',
    path: 'classes',
    label: 'Classes',
    steps: 'Open Classes to see the grades and sections you can work with, and open a class to see its students.',
    keywords: ['class', 'classes', 'grade', 'section', 'classe', 'amasomo', 'darasa'],
  },
  {
    id: 'students',
    permission: 'students',
    path: 'students',
    label: 'Students',
    steps: 'Open Students to find a learner, open their profile, and review the class they belong to.',
    keywords: ['student', 'students', 'learner', 'élève', 'eleves', 'umunyeshuri', 'abanyeshuri', 'mwanafunzi'],
  },
  {
    id: 'register-student',
    permission: 'students',
    path: 'students/register',
    label: 'Register a student',
    denyRoles: ['TEACHER'],
    steps: 'Open Register a student, fill in the learner’s details and class, then save the enrollment.',
    keywords: ['enroll', 'enrol', 'register student', 'add student', 'add a student', 'new student', 'inscrire', 'andikisha', 'sajili'],
  },
  {
    id: 'courses',
    permission: 'courses',
    path: 'courses',
    label: 'Courses',
    steps: 'Open Courses to see the subjects you teach and the class each course belongs to.',
    keywords: ['course', 'courses', 'subject', 'cours', 'isomo', 'somo'],
  },
  {
    id: 'timetable',
    permission: 'timetable',
    path: 'timetable',
    label: 'Timetable',
    steps: 'Open Timetable to see which class and subject you have on each day.',
    keywords: ['timetable', 'schedule', 'emploi du temps', 'gahunda', 'ratiba'],
  },
  {
    id: 'live-class',
    permission: 'online_classes',
    path: 'online-classes',
    label: 'Start a live class',
    steps: 'Open Live classes. Create the session for your class, add the meeting link, and start it when the lesson begins.',
    keywords: ['live', 'online class', 'meeting', 'zoom', 'cours en direct', 'isomo kuri interineti', 'darasa la moja kwa moja'],
  },
  {
    id: 'messages',
    permission: 'communication',
    path: 'communication',
    label: 'Send a message',
    steps: 'Open Messages. Choose who should receive it, write the message, and send.',
    keywords: ['message', 'messages', 'notify', 'parent message', 'message', 'itumanaho', 'ujumbe'],
  },
  {
    id: 'elearning',
    permission: 'e_learning',
    path: 'e-learning',
    label: 'E-Learning',
    steps: 'Open E-Learning to add or open a course, then add the lesson students should study.',
    keywords: ['e-learning', 'elearning', 'lesson', 'kwiga', 'kujifunza'],
  },
  {
    id: 'elibrary',
    permission: 'e_library',
    path: 'e-library',
    label: 'E-Library',
    steps: 'Open E-Library to find a digital book and open it for reading.',
    keywords: ['e-library', 'elibrary', 'ebook', 'digital book', 'isomero rya elegitoronike'],
  },
  {
    id: 'activities',
    permission: 'extracurricular',
    path: 'extracurricular',
    label: 'Activities',
    steps: 'Open Activities. Add the activity, enroll students, and assign the coach.',
    keywords: ['activity', 'activities', 'club', 'sport', 'coach', 'activité', 'ibikorwa', 'shughuli'],
  },
  {
    id: 'transport',
    permission: 'transport',
    path: 'transport',
    label: 'Transport',
    steps: 'Open Transport to see bus routes and which students ride each one.',
    keywords: ['transport', 'bus', 'route', 'ubwikorezi', 'basi'],
  },
  {
    id: 'fees',
    permission: 'fees',
    path: 'fees',
    label: 'School fees',
    steps: 'Open Fees. Find the student, then record the payment or update the fee status.',
    keywords: ['fee', 'fees', 'payment', 'tuition', 'pay', 'frais', 'amafaranga', 'ada'],
  },
  {
    id: 'finance',
    permission: 'fees',
    path: 'finance',
    label: 'Finance desk',
    steps: 'Open Finance desk to review collections. Use Import Excel when the tuition workbook is ready.',
    keywords: ['finance', 'excel', 'import', 'bureau finance', 'ibiro by’imari', 'fedha'],
  },
  {
    id: 'tuition',
    permission: 'fees',
    path: 'tuition-ledger',
    label: 'Tuition ledger',
    steps: 'Open Tuition ledger to see what each student has been charged and what is still unpaid.',
    keywords: ['ledger', 'balance', 'unpaid', 'registre', 'icyegeranyo'],
  },
  {
    id: 'reports',
    permission: 'reports',
    path: 'reports',
    label: 'Reports',
    steps: 'Open Reports and choose the report for the campus and academic year you are viewing.',
    keywords: ['report', 'reports', 'statistic', 'rapport', 'raporo', 'ripoti'],
  },
  {
    id: 'teachers',
    permission: 'teachers',
    path: 'teachers',
    label: 'Teachers',
    steps: 'Open Teachers to add a staff member or open an existing teacher profile.',
    keywords: ['teacher', 'teachers', 'staff', 'enseignant', 'umwarimu', 'abarimu', 'mwalimu'],
  },
  {
    id: 'users',
    permission: 'users',
    path: 'users',
    label: 'User accounts',
    steps: 'Open Users to give someone a login, choose their role, or reset access.',
    keywords: ['user', 'users', 'account', 'login', 'role', 'password', 'compte', 'abakoresha'],
  },
  {
    id: 'academic-year',
    permission: 'academic_year',
    path: 'academic-years',
    label: 'Academic year',
    steps: 'Open Academic year to start or close the year the campus is working in.',
    keywords: ['academic year', 'school year', 'année', 'umwaka', 'mwaka wa shule'],
  },
  {
    id: 'school',
    permission: 'school',
    path: 'school',
    label: 'School profile',
    steps: 'Open School profile to update the campus contact details and bank information.',
    keywords: ['school profile', 'contact', 'bank', 'profil', 'umwirondoro'],
  },
  {
    id: 'website',
    permission: 'website',
    path: 'website',
    label: 'Website',
    steps: 'Open Website CMS to change what families see on the public school website.',
    keywords: ['website', 'cms', 'public site', 'urubuga', 'tovuti'],
  },
  {
    id: 'library',
    permission: 'library',
    path: 'library',
    label: 'Library',
    steps: 'Open Library to add a book or record a loan and a return.',
    keywords: ['library', 'book', 'borrow', 'loan', 'bibliothèque', 'isomero', 'maktaba'],
  },
  {
    id: 'id-cards',
    permission: 'students',
    path: 'id-cards',
    label: 'ID cards',
    denyRoles: ['TEACHER'],
    steps: 'Open ID cards, choose the students, and print their cards.',
    keywords: ['id card', 'identity card', 'badge', 'carte', 'indangamuntu'],
  },
  {
    id: 'bulletin',
    permission: 'marks',
    path: 'bulletin-report',
    label: 'Bulletin',
    denyRoles: ['TEACHER'],
    steps: 'Open Bulletin, choose the class and period, then review or print the report cards.',
    keywords: ['bulletin', 'report card', 'buletine', 'bulletin scolaire'],
  },
  {
    id: 'midterms',
    permission: 'marks',
    path: 'midterms',
    label: 'Assessment periods',
    steps: 'Open Périodes to see the assessment periods used when marks are entered.',
    keywords: ['period', 'période', 'midterm', 'trimester', 'trimestre', 'igihembwe'],
  },
];

export function actionsForRole(role) {
  return ACTIONS.filter((action) => (
    hasPermission(role, action.permission)
    && !(action.denyRoles || []).includes(role)
  ));
}

function publicAction(action, language) {
  const copy = guideCopy(action, language);
  return { id: action.id, label: copy.label, path: action.path };
}

export function matchGuide(question, role, language = 'en') {
  const lang = normalizeGuideLanguage(language);
  const allowed = actionsForRole(role);
  const q = String(question || '').toLowerCase();
  const scored = allowed
    .map((action) => ({
      action,
      score: action.keywords.reduce((total, keyword) => (
        total + (q.includes(keyword) ? keyword.length : 0)
      ), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked = (scored.length ? scored : allowed.slice(0, 4).map((action) => ({ action })))
    .slice(0, 3)
    .map((item) => item.action);

  const reply = guideReply(role, lang, scored.length ? picked[0] : null);

  return {
    explanation: reply.explanation,
    steps: reply.steps,
    actions: picked.map((action) => publicAction(action, lang)),
  };
}

export function guideCatalogForPrompt(role, language = 'en') {
  const lang = normalizeGuideLanguage(language);
  return actionsForRole(role).map((action) => {
    const copy = guideCopy(action, lang);
    return {
      id: action.id,
      label: copy.label,
      steps: copy.steps,
    };
  });
}

export function parseGuideReply(text, role, language = 'en') {
  const lang = normalizeGuideLanguage(language);
  const raw = String(text || '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const explanation = String(data.explanation || data.answer || '').trim();
  const modelSteps = Array.isArray(data.steps)
    ? data.steps.map((step) => String(step || '').trim()).filter(Boolean).slice(0, 8)
    : splitGuideSteps(explanation);
  if (!explanation && !modelSteps.length) return null;
  const allowed = new Map(actionsForRole(role).map((action) => [action.id, action]));
  const ids = Array.isArray(data.actions) ? data.actions : [];
  const actions = [];
  for (const id of ids) {
    const action = allowed.get(String(id));
    if (!action || actions.some((item) => item.id === action.id)) continue;
    actions.push(publicAction(action, lang));
    if (actions.length === 3) break;
  }
  return { explanation, steps: modelSteps, actions };
}
