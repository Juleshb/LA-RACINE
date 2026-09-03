import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizePermission, hasPermission, PERMISSIONS } from '../config/permissions.js';
import { studentScopeWhere, classScopeWhere, campusYearWhere } from '../lib/scope.js';
import { teacherCourseWhere } from '../lib/teacherAccess.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.REPORTS));

function fmtDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function startOfDay(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Build Prisma date filter from dateFrom/dateTo, with optional legacy single `date`. */
function dateRangeFilter(query, field = 'createdAt') {
  const { dateFrom, dateTo, date } = query;
  const from = startOfDay(dateFrom || date);
  const to = endOfDay(dateTo || (dateFrom || date ? (dateTo || date || dateFrom) : null));

  if (!from && !to) return null;

  const range = {};
  if (from) range.gte = from;
  if (to) range.lte = to;
  return { [field]: range };
}

function requireDomain(req, permission) {
  return hasPermission(req.user.role, permission);
}

const REPORT_CATALOG = [
  {
    id: 'students',
    title: 'Student roster',
    description: 'All students with class, status, and contact details',
    category: 'People',
    permission: PERMISSIONS.STUDENTS,
    filters: ['classId', 'status', 'dateRange'],
    dateFieldLabel: 'Registered between',
  },
  {
    id: 'teachers',
    title: 'Teachers list',
    description: 'Teachers assigned to this campus and academic year',
    category: 'People',
    permission: PERMISSIONS.TEACHERS,
    filters: ['dateRange'],
    dateFieldLabel: 'Added between',
  },
  {
    id: 'classes',
    title: 'Classes overview',
    description: 'Classes with grade, section, teacher, and student counts',
    category: 'Academic',
    permission: PERMISSIONS.CLASSES,
    filters: [],
  },
  {
    id: 'courses',
    title: 'Courses / subjects',
    description: 'Subjects with grading maxima and assigned teachers',
    category: 'Academic',
    permission: PERMISSIONS.COURSES,
    filters: ['classId'],
  },
  {
    id: 'attendance',
    title: 'Attendance register',
    description: 'Attendance records by class and date range',
    category: 'Assessment',
    permission: PERMISSIONS.ATTENDANCE,
    filters: ['classId', 'dateRange'],
    dateFieldLabel: 'Attendance date',
  },
  {
    id: 'marks',
    title: 'Marks ledger',
    description: 'Recorded marks by student, subject, term, and assessment',
    category: 'Assessment',
    permission: PERMISSIONS.MARKS,
    filters: ['classId', 'term', 'dateRange'],
    dateFieldLabel: 'Recorded between',
  },
  {
    id: 'fees',
    title: 'Fees & payments',
    description: 'Fee payments with status, amounts, and due dates',
    category: 'Finance',
    permission: PERMISSIONS.FEES,
    filters: ['status', 'feeType', 'dateRange'],
    dateFieldLabel: 'Due date between',
  },
  {
    id: 'library-books',
    title: 'Library inventory',
    description: 'Books with copies and availability',
    category: 'Library',
    permission: PERMISSIONS.LIBRARY,
    filters: [],
  },
  {
    id: 'library-loans',
    title: 'Library loans',
    description: 'Active and past book loans',
    category: 'Library',
    permission: PERMISSIONS.LIBRARY,
    filters: ['dateRange'],
    dateFieldLabel: 'Loaned between',
  },
  {
    id: 'homework',
    title: 'Homework assignments',
    description: 'Homework by class with due dates',
    category: 'Assessment',
    permission: PERMISSIONS.HOMEWORK,
    filters: ['classId', 'dateRange'],
    dateFieldLabel: 'Due date between',
  },
  {
    id: 'transport-routes',
    title: 'Transport routes',
    description: 'Bus routes, vehicles, and passenger counts',
    category: 'Transport',
    permission: PERMISSIONS.TRANSPORT,
    filters: [],
  },
  {
    id: 'transport-attendance',
    title: 'Transport attendance',
    description: 'Bus attendance by route and date range',
    category: 'Transport',
    permission: PERMISSIONS.TRANSPORT,
    filters: ['dateRange'],
    dateFieldLabel: 'Attendance date',
  },
  {
    id: 'extracurricular',
    title: 'Activities overview',
    description: 'All clubs with instructor, capacity, and enrollment counts',
    category: 'Activities',
    permission: PERMISSIONS.EXTRACURRICULAR,
    filters: ['dateRange'],
    dateFieldLabel: 'Created between',
  },
  {
    id: 'extracurricular-enrollments',
    title: 'Activity enrollments',
    description: 'Student-by-student list of activity enrollments',
    category: 'Activities',
    permission: PERMISSIONS.EXTRACURRICULAR,
    filters: ['dateRange'],
    dateFieldLabel: 'Enrolled between',
  },
  {
    id: 'timetable',
    title: 'Timetable slots',
    description: 'Weekly timetable entries by class',
    category: 'Academic',
    permission: PERMISSIONS.TIMETABLE,
    filters: ['classId'],
  },
];

router.get('/catalog', (req, res) => {
  const items = REPORT_CATALOG.filter((item) => requireDomain(req, item.permission));
  res.json({ reports: items });
});

router.get('/:type', async (req, res) => {
  try {
    const type = req.params.type;
    const def = REPORT_CATALOG.find((r) => r.id === type);
    if (!def) return res.status(404).json({ error: 'Report type not found' });
    if (!requireDomain(req, def.permission)) {
      return res.status(403).json({ error: 'You do not have permission for this report' });
    }

    const { classId, status, feeType, date, dateFrom, dateTo, term } = req.query;
    const queryDates = { date, dateFrom, dateTo };
    let columns = [];
    let rows = [];
    let meta = {
      title: def.title,
      generatedAt: new Date().toISOString(),
      dateFrom: dateFrom || date || '',
      dateTo: dateTo || date || '',
    };

    if (type === 'students') {
      const scope = await studentScopeWhere(req);
      const createdFilter = dateRangeFilter(queryDates, 'createdAt');
      const students = await prisma.student.findMany({
        where: {
          ...scope,
          ...(classId ? { classId } : {}),
          ...(status ? { registrationStatus: status } : {}),
          ...(createdFilter || {}),
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          class: { select: { name: true, grade: true, section: true } },
          parent: { select: { phone: true } },
        },
      });
      columns = [
        { key: 'studentId', label: 'Student ID' },
        { key: 'lastName', label: 'Last name (Nom)' },
        { key: 'postName', label: 'Surname (Post-nom)' },
        { key: 'firstName', label: 'First name (Prénom)' },
        { key: 'dateOfBirth', label: 'Date of birth' },
        { key: 'className', label: 'Class' },
        { key: 'grade', label: 'Grade' },
        { key: 'status', label: 'Registration' },
        { key: 'gender', label: 'Gender' },
        { key: 'fatherName', label: 'Father name' },
        { key: 'motherName', label: 'Mother name' },
        { key: 'phone', label: 'Phone' },
        { key: 'parentPhone', label: 'Parent phone' },
        { key: 'createdAt', label: 'Registered' },
      ];
      rows = students.map((s) => ({
        studentId: s.studentId,
        lastName: s.lastName || '',
        postName: s.postName || '',
        firstName: s.firstName || '',
        dateOfBirth: fmtDate(s.dateOfBirth),
        className: s.class?.name || '',
        grade: s.class?.grade || '',
        status: s.registrationStatus || '',
        gender: s.gender || '',
        fatherName: s.fatherName || '',
        motherName: s.motherName || '',
        phone: s.phone || '',
        parentPhone: s.parentPhone || s.parent?.phone || '',
        createdAt: fmtDate(s.createdAt),
      }));
    } else if (type === 'teachers') {
      const createdFilter = dateRangeFilter(queryDates, 'createdAt');
      const teachers = await prisma.teacher.findMany({
        where: {
          ...campusYearWhere(req),
          ...(createdFilter || {}),
        },
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { subjects: true, classes: true } },
          user: { select: { email: true, isActive: true } },
        },
      });
      columns = [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'subject', label: 'Subject' },
        { key: 'address', label: 'Full address' },
        { key: 'qualifications', label: 'Qualifications' },
        { key: 'bankName', label: 'Bank name' },
        { key: 'bankAccount', label: 'Bank account' },
        { key: 'courses', label: 'Courses' },
        { key: 'classes', label: 'Classes' },
        { key: 'account', label: 'Account' },
        { key: 'createdAt', label: 'Added' },
      ];
      rows = teachers.map((t) => ({
        name: t.name,
        email: t.email || t.user?.email || '',
        phone: t.phone || '',
        subject: t.subject || '',
        address: t.address || '',
        qualifications: t.qualifications || '',
        bankName: t.bankName || '',
        bankAccount: t.bankAccount || '',
        courses: t._count.subjects,
        classes: t._count.classes,
        account: t.user ? (t.user.isActive ? 'Active' : 'Inactive') : 'None',
        createdAt: fmtDate(t.createdAt),
      }));
    } else if (type === 'classes') {
      const classScope = await classScopeWhere(req);
      const classes = await prisma.class.findMany({
        where: classScope,
        orderBy: [{ grade: 'asc' }, { section: 'asc' }],
        include: {
          teacher: { select: { name: true } },
          _count: { select: { students: true, subjects: true } },
        },
      });
      columns = [
        { key: 'name', label: 'Class' },
        { key: 'grade', label: 'Grade' },
        { key: 'section', label: 'Section' },
        { key: 'teacher', label: 'Class teacher' },
        { key: 'students', label: 'Students' },
        { key: 'subjects', label: 'Subjects' },
      ];
      rows = classes.map((c) => ({
        name: c.name,
        grade: c.grade,
        section: c.section,
        teacher: c.teacher?.name || '',
        students: c._count.students,
        subjects: c._count.subjects,
      }));
    } else if (type === 'courses') {
      const teacherFilter = await teacherCourseWhere(req);
      const courses = await prisma.subject.findMany({
        where: {
          campusId: req.campusId,
          class: { academicYearId: req.academicYearId },
          ...(classId ? { classId } : {}),
          ...teacherFilter,
        },
        orderBy: [{ categoryOrder: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          class: { select: { name: true, grade: true } },
          teacher: { select: { name: true } },
        },
      });
      columns = [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Subject' },
        { key: 'category', label: 'Domain' },
        { key: 'className', label: 'Class' },
        { key: 'teacher', label: 'Teacher' },
        { key: 'testsMarkMax', label: 'Tests max' },
        { key: 'examMax', label: 'Exam max' },
        { key: 'totalMax', label: 'Total max' },
      ];
      rows = courses.map((c) => ({
        code: c.code,
        name: c.name,
        category: c.category || '',
        className: c.class?.name || '',
        teacher: c.teacher?.name || '',
        testsMarkMax: c.testsMarkMax ?? '',
        examMax: c.examMax ?? '',
        totalMax: c.totalMax ?? '',
      }));
    } else if (type === 'attendance') {
      const scope = await studentScopeWhere(req);
      const dateFilter = dateRangeFilter(queryDates, 'date') || dateRangeFilter(
        { date: new Date().toISOString().slice(0, 10) },
        'date',
      );

      const records = await prisma.attendance.findMany({
        where: {
          ...dateFilter,
          student: {
            ...scope,
            ...(classId ? { classId } : {}),
          },
        },
        orderBy: [{ date: 'asc' }, { student: { lastName: 'asc' } }],
        include: {
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              class: { select: { name: true } },
            },
          },
        },
      });
      columns = [
        { key: 'date', label: 'Date' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'name', label: 'Name' },
        { key: 'className', label: 'Class' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes' },
      ];
      rows = records.map((r) => ({
        date: fmtDate(r.date),
        studentId: r.student.studentId,
        name: `${r.student.firstName} ${r.student.lastName}`,
        className: r.student.class?.name || '',
        status: r.status,
        notes: r.notes || '',
      }));
    } else if (type === 'marks') {
      const scope = await studentScopeWhere(req);
      const createdFilter = dateRangeFilter(queryDates, 'createdAt');
      const students = await prisma.student.findMany({
        where: { ...scope, ...(classId ? { classId } : {}) },
        select: { id: true },
      });
      const studentIds = students.map((s) => s.id);
      const teacherFilter = await teacherCourseWhere(req);
      const subjects = await prisma.subject.findMany({
        where: {
          campusId: req.campusId,
          class: { academicYearId: req.academicYearId },
          ...(classId ? { classId } : {}),
          ...teacherFilter,
        },
        select: { id: true },
      });
      const subjectIds = subjects.map((s) => s.id);

      const marks = await prisma.mark.findMany({
        where: {
          studentId: { in: studentIds.length ? studentIds : ['__none__'] },
          subjectId: { in: subjectIds.length ? subjectIds : ['__none__'] },
          ...(term ? { term } : {}),
          ...(createdFilter || {}),
        },
        orderBy: [{ term: 'asc' }, { assessment: 'asc' }],
        include: {
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              class: { select: { name: true } },
            },
          },
          subject: { select: { name: true, code: true } },
        },
        take: 5000,
      });
      columns = [
        { key: 'studentId', label: 'Student ID' },
        { key: 'name', label: 'Name' },
        { key: 'className', label: 'Class' },
        { key: 'subject', label: 'Subject' },
        { key: 'term', label: 'Term' },
        { key: 'assessment', label: 'Assessment' },
        { key: 'score', label: 'Score' },
        { key: 'maxScore', label: 'Max' },
        { key: 'percent', label: '%' },
        { key: 'recordedAt', label: 'Recorded' },
      ];
      rows = marks.map((m) => ({
        studentId: m.student.studentId,
        name: `${m.student.firstName} ${m.student.lastName}`,
        className: m.student.class?.name || '',
        subject: m.subject.name,
        term: m.term,
        assessment: m.assessment === 'TEST' && m.catNumber > 0
          ? `Test ${m.catNumber}`
          : m.assessment,
        score: m.score,
        maxScore: m.maxScore,
        percent: m.maxScore ? Math.round((m.score / m.maxScore) * 1000) / 10 : '',
        recordedAt: fmtDate(m.createdAt),
      }));
    } else if (type === 'fees') {
      const scope = await studentScopeWhere(req);
      const dueFilter = dateRangeFilter(queryDates, 'dueDate');
      const fees = await prisma.feePayment.findMany({
        where: {
          student: scope,
          ...(status ? { status } : {}),
          ...(feeType ? { feeType } : {}),
          ...(dueFilter || {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              class: { select: { name: true } },
            },
          },
        },
      });
      columns = [
        { key: 'receiptNumber', label: 'Receipt' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'name', label: 'Name' },
        { key: 'className', label: 'Class' },
        { key: 'feeType', label: 'Fee type' },
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
        { key: 'dueDate', label: 'Due date' },
        { key: 'paidDate', label: 'Paid date' },
      ];
      rows = fees.map((f) => ({
        receiptNumber: f.receiptNumber,
        studentId: f.student.studentId,
        name: `${f.student.firstName} ${f.student.lastName}`,
        className: f.student.class?.name || '',
        feeType: f.feeType,
        amount: f.amount,
        status: f.status,
        dueDate: fmtDate(f.dueDate),
        paidDate: fmtDate(f.paidDate),
      }));
    } else if (type === 'library-books') {
      const books = await prisma.book.findMany({
        where: { campusId: req.campusId },
        orderBy: { title: 'asc' },
      });
      columns = [
        { key: 'title', label: 'Title' },
        { key: 'author', label: 'Author' },
        { key: 'isbn', label: 'ISBN' },
        { key: 'category', label: 'Category' },
        { key: 'copies', label: 'Copies' },
        { key: 'available', label: 'Available' },
      ];
      rows = books.map((b) => ({
        title: b.title,
        author: b.author || '',
        isbn: b.isbn || '',
        category: b.category || '',
        copies: b.copies,
        available: b.available,
      }));
    } else if (type === 'library-loans') {
      const loanedFilter = dateRangeFilter(queryDates, 'loanedAt');
      const loans = await prisma.bookLoan.findMany({
        where: {
          book: { campusId: req.campusId },
          ...(loanedFilter || {}),
        },
        orderBy: { loanedAt: 'desc' },
        include: { book: { select: { title: true, isbn: true } } },
        take: 3000,
      });
      columns = [
        { key: 'book', label: 'Book' },
        { key: 'borrower', label: 'Borrower' },
        { key: 'borrowerType', label: 'Type' },
        { key: 'loanedAt', label: 'Loaned' },
        { key: 'dueDate', label: 'Due' },
        { key: 'returnedAt', label: 'Returned' },
        { key: 'status', label: 'Status' },
      ];
      rows = loans.map((l) => ({
        book: l.book.title,
        borrower: l.borrowerName,
        borrowerType: l.borrowerType,
        loanedAt: fmtDate(l.loanedAt),
        dueDate: fmtDate(l.dueDate),
        returnedAt: fmtDate(l.returnedAt),
        status: l.status,
      }));
    } else if (type === 'homework') {
      const dueFilter = dateRangeFilter(queryDates, 'dueDate');
      const homework = await prisma.homework.findMany({
        where: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          ...(classId ? { classId } : {}),
          ...(dueFilter || {}),
        },
        orderBy: { dueDate: 'desc' },
        include: {
          class: { select: { name: true } },
          subject: { select: { name: true } },
          _count: { select: { submissions: true } },
        },
      });
      columns = [
        { key: 'title', label: 'Title' },
        { key: 'className', label: 'Class' },
        { key: 'subject', label: 'Subject' },
        { key: 'dueDate', label: 'Due date' },
        { key: 'submissions', label: 'Submissions' },
      ];
      rows = homework.map((h) => ({
        title: h.title,
        className: h.class?.name || '',
        subject: h.subject?.name || '',
        dueDate: fmtDate(h.dueDate),
        submissions: h._count.submissions,
      }));
    } else if (type === 'transport-routes') {
      const routes = await prisma.transportRoute.findMany({
        where: { campusId: req.campusId, academicYearId: req.academicYearId },
        orderBy: { name: 'asc' },
        include: {
          schedules: {
            where: { isActive: true },
            take: 1,
            include: {
              vehicle: { select: { plateNumber: true, capacity: true } },
              driver: { select: { name: true, phone: true } },
            },
          },
          _count: { select: { enrollments: true } },
        },
      });
      columns = [
        { key: 'name', label: 'Route' },
        { key: 'code', label: 'Code' },
        { key: 'vehicle', label: 'Vehicle' },
        { key: 'capacity', label: 'Capacity' },
        { key: 'driver', label: 'Driver' },
        { key: 'phone', label: 'Driver phone' },
        { key: 'passengers', label: 'Passengers' },
        { key: 'active', label: 'Active' },
      ];
      rows = routes.map((r) => {
        const schedule = r.schedules[0];
        return {
          name: r.name,
          code: r.code,
          vehicle: schedule?.vehicle?.plateNumber || '',
          capacity: schedule?.vehicle?.capacity ?? '',
          driver: schedule?.driver?.name || '',
          phone: schedule?.driver?.phone || '',
          passengers: r._count.enrollments,
          active: r.isActive ? 'Yes' : 'No',
        };
      });
    } else if (type === 'transport-attendance') {
      const dateFilter = dateRangeFilter(queryDates, 'date') || dateRangeFilter(
        { date: new Date().toISOString().slice(0, 10) },
        'date',
      );
      const records = await prisma.transportAttendance.findMany({
        where: {
          ...dateFilter,
          route: {
            campusId: req.campusId,
            academicYearId: req.academicYearId,
          },
        },
        orderBy: [{ date: 'asc' }],
        include: {
          route: { select: { name: true, code: true } },
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              class: { select: { name: true } },
            },
          },
        },
        take: 5000,
      });
      columns = [
        { key: 'date', label: 'Date' },
        { key: 'route', label: 'Route' },
        { key: 'direction', label: 'Direction' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'name', label: 'Name' },
        { key: 'className', label: 'Class' },
        { key: 'status', label: 'Status' },
      ];
      rows = records.map((r) => ({
        date: fmtDate(r.date),
        route: r.route?.name || '',
        direction: r.direction || '',
        studentId: r.student?.studentId || '',
        name: r.student ? `${r.student.firstName} ${r.student.lastName}` : '',
        className: r.student?.class?.name || '',
        status: r.status,
      }));
    } else if (type === 'extracurricular') {
      const createdFilter = dateRangeFilter(queryDates, 'createdAt');
      const activities = await prisma.extracurricularActivity.findMany({
        where: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          ...(createdFilter || {}),
        },
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { enrollments: true } },
          instructorTeacher: { select: { name: true } },
          externalInstructor: { select: { name: true } },
        },
      });
      columns = [
        { key: 'name', label: 'Activity' },
        { key: 'category', label: 'Category' },
        { key: 'status', label: 'Status' },
        { key: 'schedule', label: 'Schedule' },
        { key: 'location', label: 'Location' },
        { key: 'instructor', label: 'Instructor' },
        { key: 'enrollments', label: 'Enrolled' },
        { key: 'maxStudents', label: 'Capacity' },
        { key: 'seatsLeft', label: 'Seats left' },
        { key: 'allowedGrades', label: 'Grades' },
        { key: 'createdAt', label: 'Created' },
      ];
      rows = activities.map((a) => {
        const enrolled = a._count.enrollments;
        const max = a.maxStudents;
        const instructor = a.instructorTeacher?.name
          || a.externalInstructor?.name
          || a.instructor
          || '';
        let grades = '';
        try {
          const parsed = typeof a.allowedGrades === 'string'
            ? JSON.parse(a.allowedGrades)
            : a.allowedGrades;
          grades = Array.isArray(parsed) ? parsed.join(', ') : String(parsed || '');
        } catch {
          grades = '';
        }
        return {
          name: a.name,
          category: a.category || '',
          status: a.isActive ? 'Active' : 'Inactive',
          schedule: a.schedule || '',
          location: a.location || '',
          instructor,
          enrollments: enrolled,
          maxStudents: max ?? '',
          seatsLeft: max != null ? Math.max(0, max - enrolled) : '',
          allowedGrades: grades,
          createdAt: fmtDate(a.createdAt),
        };
      });
    } else if (type === 'extracurricular-enrollments') {
      const enrolledFilter = dateRangeFilter(queryDates, 'enrolledAt');
      const enrollments = await prisma.extracurricularEnrollment.findMany({
        where: {
          activity: {
            campusId: req.campusId,
            academicYearId: req.academicYearId,
          },
          ...(enrolledFilter || {}),
        },
        orderBy: [{ enrolledAt: 'desc' }],
        take: 5000,
        include: {
          activity: {
            select: {
              name: true,
              category: true,
              schedule: true,
              instructor: true,
              instructorTeacher: { select: { name: true } },
              externalInstructor: { select: { name: true } },
            },
          },
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              postName: true,
              gender: true,
              class: { select: { name: true, grade: true } },
            },
          },
        },
      });
      columns = [
        { key: 'activity', label: 'Activity' },
        { key: 'category', label: 'Category' },
        { key: 'instructor', label: 'Instructor' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'lastName', label: 'Last name' },
        { key: 'postName', label: 'Surname (Post-nom)' },
        { key: 'firstName', label: 'First name' },
        { key: 'gender', label: 'Gender' },
        { key: 'className', label: 'Class' },
        { key: 'grade', label: 'Grade' },
        { key: 'enrolledAt', label: 'Enrolled on' },
      ];
      rows = enrollments.map((e) => ({
        activity: e.activity?.name || '',
        category: e.activity?.category || '',
        instructor: e.activity?.instructorTeacher?.name
          || e.activity?.externalInstructor?.name
          || e.activity?.instructor
          || '',
        studentId: e.student?.studentId || '',
        lastName: e.student?.lastName || '',
        postName: e.student?.postName || '',
        firstName: e.student?.firstName || '',
        gender: e.student?.gender || '',
        className: e.student?.class?.name || '',
        grade: e.student?.class?.grade || '',
        enrolledAt: fmtDate(e.enrolledAt),
      }));
    } else if (type === 'timetable') {
      const slots = await prisma.timetableSlot.findMany({
        where: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          ...(classId ? { classId } : {}),
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          class: { select: { name: true } },
          subject: { select: { name: true, code: true } },
        },
      });
      const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      columns = [
        { key: 'className', label: 'Class' },
        { key: 'day', label: 'Day' },
        { key: 'startTime', label: 'Start' },
        { key: 'endTime', label: 'End' },
        { key: 'subject', label: 'Subject' },
        { key: 'room', label: 'Room' },
      ];
      rows = slots.map((s) => ({
        className: s.class?.name || '',
        day: dayNames[s.dayOfWeek] || s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject?.name || '',
        room: s.room || '',
      }));
    } else {
      return res.status(404).json({ error: 'Report type not found' });
    }

    res.json({
      id: def.id,
      title: def.title,
      description: def.description,
      category: def.category,
      columns,
      rows,
      meta: { ...meta, rowCount: rows.length },
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
