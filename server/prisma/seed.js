import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ensureDefaultClasses, ensureDefaultClassesForCampus } from '../src/lib/defaultClasses.js';
import { applyCurriculumToAllClasses } from '../src/lib/curriculum.js';
import { ensureCampusDefaultTemplate } from '../src/lib/timetableTemplateService.js';

const prisma = new PrismaClient();

async function seedStudentLearningDemo(prisma, { campus, year, p5a }) {
  const libCount = await prisma.eLibraryItem.count({ where: { campusId: campus.id } });
  if (libCount === 0) {
    await prisma.eLibraryItem.createMany({
      data: [
        {
          campusId: campus.id,
          title: 'Adventures in Kigali',
          author: 'Jean Paul',
          category: 'Stories',
          readingLevel: 'Easy',
          description: 'A fun story about friendship and school life.',
          coverEmoji: '📗',
        },
        {
          campusId: campus.id,
          title: 'Science for Kids: Plants',
          author: 'École La RACINE',
          category: 'Science',
          readingLevel: 'Easy',
          description: 'Learn how plants grow with pictures and simple words.',
          coverEmoji: '🌱',
        },
        {
          campusId: campus.id,
          title: 'Counting Fun 1-20',
          author: 'École La RACINE',
          category: 'Math',
          readingLevel: 'Easy',
          description: 'Practice counting with colourful pictures.',
          coverEmoji: '🔢',
        },
      ],
    });
  }

  const courseCount = await prisma.eLearningCourse.count({
    where: { campusId: campus.id, academicYearId: year.id },
  });
  if (courseCount === 0) {
    await prisma.eLearningCourse.create({
      data: {
        campusId: campus.id,
        academicYearId: year.id,
        classId: p5a?.id || null,
        title: 'Math Adventures',
        subject: 'Mathematics',
        description: 'Watch fun videos and try quick exercises!',
        coverEmoji: '🔢',
        sortOrder: 0,
        lessons: {
          create: [
            {
              campusId: campus.id,
              academicYearId: year.id,
              title: 'Fractions made easy',
              description: 'Watch this short lesson first.',
              videoUrl: 'https://www.youtube.com/watch?v=wf-BqAjZb6M',
              youtubeId: 'wf-BqAjZb6M',
              coverEmoji: '📺',
              sortOrder: 0,
            },
          ],
        },
        exercises: {
          create: [
            {
              sortOrder: 0,
              type: 'TRUE_FALSE',
              prompt: 'A half means 1 of 2 equal parts.',
              correctAnswer: 'true',
              points: 1,
            },
            {
              sortOrder: 1,
              type: 'MULTIPLE_CHOICE',
              prompt: 'What is 2 + 2?',
              options: ['3', '4', '5', '6'],
              correctAnswer: '1',
              points: 1,
            },
          ],
        },
      },
    });

    await prisma.eLearningCourse.create({
      data: {
        campusId: campus.id,
        academicYearId: year.id,
        title: 'English Stories',
        subject: 'English',
        description: 'Listen, read, and answer simple questions.',
        coverEmoji: '📖',
        sortOrder: 1,
        lessons: {
          create: [
            {
              campusId: campus.id,
              academicYearId: year.id,
              title: 'Reading: The River',
              description: 'Watch and listen to the story.',
              videoUrl: 'https://www.youtube.com/watch?v=8J7ZmH0IXuk',
              youtubeId: '8J7ZmH0IXuk',
              coverEmoji: '📺',
              sortOrder: 0,
            },
          ],
        },
        exercises: {
          create: [
            {
              sortOrder: 0,
              type: 'SHORT_ANSWER',
              prompt: 'What do we use to read a story?',
              correctAnswer: 'book|books|eyes',
              points: 1,
            },
          ],
        },
      },
    });
  }

  // Migrate orphan legacy lessons into a course if any exist
  const orphanLessons = await prisma.eLearningLesson.findMany({
    where: { campusId: campus.id, academicYearId: year.id, courseId: null },
  });
  if (orphanLessons.length > 0) {
    const legacy = await prisma.eLearningCourse.create({
      data: {
        campusId: campus.id,
        academicYearId: year.id,
        title: 'More lessons',
        subject: 'General',
        coverEmoji: '🎓',
        sortOrder: 99,
      },
    });
    await prisma.eLearningLesson.updateMany({
      where: { id: { in: orphanLessons.map((l) => l.id) } },
      data: { courseId: legacy.id },
    });
  }
}

async function seedOnlineClasses(prisma, { campus, year, p5a, demoStudent }) {
  const classIds = [...new Set([demoStudent?.classId, p5a?.id].filter(Boolean))];
  if (!classIds.length) return;

  const soon = new Date();
  soon.setHours(soon.getHours() + 2, 0, 0, 0);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  for (const classId of classIds) {
    const count = await prisma.onlineClassSession.count({
      where: { campusId: campus.id, academicYearId: year.id, classId },
    });
    if (count > 0) continue;

    const mathSubject = await prisma.subject.findFirst({
      where: { classId, code: 'MATH' },
      select: { id: true },
    });

    await prisma.onlineClassSession.createMany({
      data: [
        {
          campusId: campus.id,
          academicYearId: year.id,
          classId,
          subjectId: mathSubject?.id || null,
          title: 'Math live lesson',
          description: 'Join on Google Meet for today\'s fractions practice.',
          scheduledAt: soon,
          durationMinutes: 45,
          meetingUrl: 'https://meet.google.com/lookup/demo-math-class',
          meetingProvider: 'GOOGLE_MEET',
          isPublished: true,
        },
        {
          campusId: campus.id,
          academicYearId: year.id,
          classId,
          title: 'English reading circle',
          description: 'Zoom session — read together and answer questions.',
          scheduledAt: tomorrow,
          durationMinutes: 40,
          meetingUrl: 'https://zoom.us/j/1234567890',
          meetingProvider: 'ZOOM',
          isPublished: true,
        },
      ],
    });
  }
}

async function seedInteractiveHomework(prisma, { campus, year }) {
  const existing = await prisma.homework.findFirst({
    where: {
      campusId: campus.id,
      title: 'Math quiz: shapes & numbers',
    },
  });
  if (existing) {
    const hasVideo = await prisma.homeworkVideo.findFirst({ where: { homeworkId: existing.id } });
    if (!hasVideo) {
      await prisma.homeworkVideo.create({
        data: {
          homeworkId: existing.id,
          title: 'Shapes & numbers lesson',
          youtubeId: 'wf-BqAjZb6M',
          sortOrder: 0,
        },
      });
    }
    return;
  }

  const targetClass = await prisma.class.findFirst({
    where: { campusId: campus.id, academicYearId: year.id },
    orderBy: { name: 'asc' },
  });
  if (!targetClass) return;

  await prisma.homework.create({
    data: {
      campusId: campus.id,
      academicYearId: year.id,
      classId: targetClass.id,
      title: 'Math quiz: shapes & numbers',
      description: 'Watch the short lesson video, then answer all questions. The system will mark your work right away!',
      dueDate: new Date('2026-12-31'),
      totalPoints: 4,
      videos: {
        create: [
          {
            title: 'Shapes & numbers lesson',
            youtubeId: 'wf-BqAjZb6M',
            sortOrder: 0,
          },
        ],
      },
      questions: {
        create: [
          {
            sortOrder: 0,
            type: 'TRUE_FALSE',
            prompt: 'A square has 4 equal sides.',
            correctAnswer: 'true',
            points: 1,
          },
          {
            sortOrder: 1,
            type: 'MULTIPLE_CHOICE',
            prompt: 'What is 5 + 3?',
            options: ['6', '7', '8', '9'],
            correctAnswer: '2',
            points: 1,
          },
          {
            sortOrder: 2,
            type: 'SHORT_ANSWER',
            prompt: 'What colour do you get when you mix blue and yellow?',
            correctAnswer: 'green',
            points: 1,
          },
          {
            sortOrder: 3,
            type: 'TRUE_FALSE',
            prompt: '10 is smaller than 5.',
            correctAnswer: 'false',
            points: 1,
          },
        ],
      },
    },
  });
}

async function createUser({ email, password, firstName, lastName, role, campusId, teacherId, studentId, parentId, phone }) {
  const normalizedEmail = email.toLowerCase();
  const hashedPassword = await bcrypt.hash(password, 10);
  const data = {
    password: hashedPassword,
    firstName,
    lastName,
    role,
    phone: phone || null,
    campusId: (role === 'SCHOOL_MANAGER' || role === 'SCHOOL_ADMIN') ? null : campusId,
    teacherId,
    studentId,
    parentId,
  };
  return prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      firstName,
      lastName,
      role,
      phone: phone || null,
      campusId: (role === 'SCHOOL_MANAGER' || role === 'SCHOOL_ADMIN') ? null : campusId,
      teacherId,
      studentId,
      parentId,
    },
    create: {
      email: normalizedEmail,
      ...data,
    },
  });
}

async function seedCommunicationDemo(prisma, { campus, year, secretaryUser, parentUser, alice }) {
  if (!secretaryUser) return;

  const existing = await prisma.communicationBroadcast.count({ where: { campusId: campus.id } });
  if (!existing) {
    await prisma.communicationBroadcast.create({
      data: {
        campusId: campus.id,
        academicYearId: year.id,
        title: 'Welcome to La Racine Communication',
        body: 'Dear parents, you can now message the school directly from this app. Use "Contact school" to ask about your child, and watch here for announcements about fees, transport, and events.',
        category: 'GENERAL',
        priority: 'NORMAL',
        targetType: 'ALL_PARENTS',
        createdById: secretaryUser.id,
      },
    });
    console.log('Seeded welcome communication broadcast');
  }

  let student = alice;
  if (!student && parentUser?.parentId) {
    student = await prisma.student.findFirst({
      where: { campusId: campus.id, parentId: parentUser.parentId },
    });
  }
  if (!student) {
    student = await prisma.student.findFirst({ where: { campusId: campus.id, parentId: { not: null } } });
  }

  if (parentUser && student && !(await prisma.communicationThread.count({ where: { campusId: campus.id } }))) {
    await prisma.communicationThread.create({
      data: {
        campusId: campus.id,
        academicYearId: year.id,
        subject: `${student.firstName || 'Student'} — after-school pickup`,
        category: 'GENERAL',
        studentId: student.id,
        parentId: student.parentId,
        status: 'OPEN',
        initiatedBy: 'PARENT',
        createdById: parentUser.id,
        messages: {
          create: [
            {
              senderId: parentUser.id,
              body: 'Good morning. Can someone confirm what time students are dismissed on Fridays?',
            },
            {
              senderId: secretaryUser.id,
              body: 'Good morning. Classes finish at 3:30 PM on Fridays. Your child can be picked up from the main gate.',
            },
          ],
        },
      },
    });
    console.log('Seeded sample parent–school conversation');
  }
}

async function main() {
  let school = await prisma.schoolProfile.findFirst();
  if (!school) {
    school = await prisma.schoolProfile.create({
      data: {
        name: 'École La RACINE',
        abbreviation: 'LRS',
        country: 'RWANDA',
        province: 'WESTERN',
        district: 'RUBAVU',
        city: 'GISENYI',
        email: 'laracineschool@gmail.com',
        phone1: '0789028283',
        phone2: '0792445913',
        website: 'laracineschool.rw',
        tin: '121966656',
        bankAccounts: {
          create: [
            { bankName: 'BPR', accountNumber: '4493329947' },
            { bankName: 'Bank of Kigali', accountNumber: '100230804812' },
            { bankName: 'LOLC UNGUKA Finance', accountNumber: '30400994660015' },
          ],
        },
      },
    });
    console.log('Seeded school profile');
  }

  let campusGisenyi = await prisma.campus.findUnique({ where: { code: 'GISENYI' } });
  let campusRubavu = await prisma.campus.findUnique({ where: { code: 'RUBAVU' } });

  if (!campusGisenyi) {
    campusGisenyi = await prisma.campus.create({
      data: {
        name: 'La Racine — Gisenyi Campus',
        code: 'GISENYI',
        city: 'Gisenyi',
        district: 'Rubavu',
        province: 'WESTERN',
        phone: '0789028283',
        email: 'gisenyi@laracineschool.rw',
      },
    });
    console.log('Created campus:', campusGisenyi.name);
  }

  if (!campusRubavu) {
    campusRubavu = await prisma.campus.create({
      data: {
        name: 'La Racine — Rubavu Campus',
        code: 'RUBAVU',
        city: 'Rubavu',
        district: 'Rubavu',
        province: 'WESTERN',
        phone: '0792445913',
        email: 'rubavu@laracineschool.rw',
      },
    });
    console.log('Created campus:', campusRubavu.name);
  }

  const campus = campusGisenyi;

  async function ensureCampusYear(campusRecord) {
    let campusYear = await prisma.academicYear.findFirst({
      where: { campusId: campusRecord.id, isActive: true },
    });
    if (!campusYear) {
      campusYear = await prisma.academicYear.create({
        data: {
          campusId: campusRecord.id,
          name: '2025-2026',
          startDate: new Date('2025-09-01'),
          isActive: true,
          status: 'ACTIVE',
        },
      });
      console.log(`Created academic year for ${campusRecord.code}:`, campusYear.name);
    }
    const created = await ensureDefaultClasses(prisma, campusRecord.id, campusYear.id);
    if (created) {
      console.log(`Added ${created} default class(es) for ${campusRecord.code}`);
    }
    return campusYear;
  }

  const year = await ensureCampusYear(campus);
  const rubavuYear = await ensureCampusYear(campusRubavu);
  await ensureCampusDefaultTemplate(campus.id, year.id);
  await ensureCampusDefaultTemplate(campusRubavu.id, rubavuYear.id);

  if ((await prisma.user.count()) > 0) {
    const campuses = await prisma.campus.findMany();
    for (const c of campuses) {
      await prisma.teacher.updateMany({ where: { campusId: c.id, academicYearId: null }, data: { academicYearId: year.id } });
      await prisma.class.updateMany({ where: { campusId: c.id, academicYearId: null }, data: { academicYearId: year.id } });
      await prisma.student.updateMany({ where: { campusId: c.id, academicYearId: null }, data: { academicYearId: year.id } });
      const added = await ensureDefaultClassesForCampus(prisma, c.id);
      if (added) console.log(`Backfilled ${added} default class(es) for ${c.code}`);
      const years = await prisma.academicYear.findMany({ where: { campusId: c.id } });
      for (const y of years) {
        await ensureCampusDefaultTemplate(c.id, y.id);
        const curriculum = await applyCurriculumToAllClasses(prisma, c.id, y.id);
        if (curriculum.totalCreated) {
          console.log(`Backfilled ${curriculum.totalCreated} bulletin course(s) for ${c.code} (${y.name})`);
        }
      }
    }
    const secretaryUser = await prisma.user.findFirst({ where: { email: 'secretary@laracineschool.rw' } });
    const parentUser = await prisma.user.findFirst({ where: { email: 'parent@laracineschool.rw' } });
    const alice = await prisma.student.findFirst({
      where: {
        campusId: campus.id,
        registrationStatus: 'APPROVED',
        classId: { not: null },
      },
      orderBy: { studentId: 'asc' },
    });
    const demoTeacher = await prisma.teacher.findFirst({
      where: { campusId: campus.id, email: 'jb.n@laracineschool.rw' },
    });
    if (demoTeacher) {
      await prisma.user.updateMany({
        where: { email: 'teacher@laracineschool.rw' },
        data: { teacherId: demoTeacher.id, campusId: campus.id },
      });
    }
    if (alice) {
      await prisma.user.updateMany({
        where: { email: 'student@laracineschool.rw' },
        data: { studentId: alice.id, campusId: campus.id },
      });
    }
    await seedCommunicationDemo(prisma, { campus, year, secretaryUser, parentUser, alice });
    const p5a = await prisma.class.findFirst({
      where: { campusId: campus.id, academicYearId: year.id, grade: 'P5', section: 'A' },
    });
    await seedStudentLearningDemo(prisma, { campus, year, p5a });
    await seedInteractiveHomework(prisma, { campus, year });
    await seedOnlineClasses(prisma, { campus, year, p5a, demoStudent: alice });
    console.log('Users already exist — backfilled classes and bulletin courses.');
    return;
  }

  const teachers = await Promise.all([
    prisma.teacher.create({ data: { campusId: campus.id, academicYearId: year.id, name: 'Jean Baptiste N.', email: 'jb.n@laracineschool.rw', phone: '0788000101', subject: 'Mathematics' } }),
    prisma.teacher.create({ data: { campusId: campus.id, academicYearId: year.id, name: 'Marie Claire U.', email: 'mc.u@laracineschool.rw', phone: '0788000102', subject: 'English' } }),
    prisma.teacher.create({ data: { campusId: campus.id, academicYearId: year.id, name: 'Patrick M.', email: 'p.m@laracineschool.rw', phone: '0788000103', subject: 'Science' } }),
  ]);

  const defaultClasses = await prisma.class.findMany({
    where: { campusId: campus.id, academicYearId: year.id },
  });
  const findClass = (grade, section = 'A') => defaultClasses.find((c) => c.grade === grade && c.section === section);

  const classes = await Promise.all([
    prisma.class.create({ data: { campusId: campus.id, academicYearId: year.id, name: 'Primary 5 B', grade: 'P5', section: 'B', teacherId: teachers[1].id } }),
  ]);
  const p5a = findClass('P5', 'A');
  const p5b = classes[0];
  const p6a = findClass('P6', 'A');
  if (p5a) await prisma.class.update({ where: { id: p5a.id }, data: { teacherId: teachers[0].id } });
  if (p6a) await prisma.class.update({ where: { id: p6a.id }, data: { teacherId: teachers[2].id } });

  await prisma.subject.createMany({
    data: [
      { campusId: campus.id, name: 'Mathematics', code: 'MATH', classId: p5a.id, teacherId: teachers[0].id, periodsPerWeek: 5 },
      { campusId: campus.id, name: 'English', code: 'ENG', classId: p5a.id, teacherId: teachers[1].id, periodsPerWeek: 4 },
      { campusId: campus.id, name: 'Science', code: 'SCI', classId: p5a.id, teacherId: teachers[2].id, periodsPerWeek: 3 },
      { campusId: campus.id, name: 'Mathematics', code: 'MATH', classId: p6a.id, teacherId: teachers[0].id, periodsPerWeek: 5 },
    ],
  });

  const subjects = await prisma.subject.findMany({ where: { campusId: campus.id } });
  const mathP5 = subjects.find((s) => s.code === 'MATH' && s.classId === p5a.id);

  const parent1 = await prisma.parent.create({ data: { phone: '0788111001' } });

  await prisma.student.createMany({
    data: [
      { campusId: campus.id, academicYearId: year.id, studentId: 'LRS-2026-001', firstName: 'Alice', lastName: 'Mukamana', gender: 'FEMALE', parentName: 'Grace Mukamana', parentPhone: '0788111001', parentId: parent1.id, classId: p5a.id },
      { campusId: campus.id, academicYearId: year.id, studentId: 'LRS-2026-002', firstName: 'Emmanuel', lastName: 'Habimana', gender: 'MALE', parentName: 'Paul Habimana', parentPhone: '0788111002', classId: p5a.id },
      { campusId: campus.id, academicYearId: year.id, studentId: 'LRS-2026-003', firstName: 'Chantal', lastName: 'Uwase', gender: 'FEMALE', parentName: 'Ange Uwase', parentPhone: '0788111003', classId: p5b.id },
      { campusId: campus.id, academicYearId: year.id, studentId: 'LRS-2026-004', firstName: 'David', lastName: 'Niyonzima', gender: 'MALE', parentName: 'Joseph Niyonzima', parentPhone: '0788111004', classId: p6a.id },
      { campusId: campus.id, academicYearId: year.id, studentId: 'LRS-2026-005', firstName: 'Esther', lastName: 'Ingabire', gender: 'FEMALE', parentName: 'Rose Ingabire', parentPhone: '0788111005', classId: p6a.id },
    ],
  });

  const students = await prisma.student.findMany({ where: { campusId: campus.id } });
  const alice = students.find((s) => s.studentId === 'LRS-2026-001');
  const emmanuel = students.find((s) => s.studentId === 'LRS-2026-002');

  if (mathP5 && alice && emmanuel) {
    await prisma.mark.createMany({
      data: [
        { studentId: alice.id, subjectId: mathP5.id, term: 'Term 1', assessment: 'Final', score: 82, maxScore: 100 },
        { studentId: emmanuel.id, subjectId: mathP5.id, term: 'Term 1', assessment: 'Final', score: 74, maxScore: 100 },
      ],
    });
  }

  const defaultPassword = 'password123';

  await createUser({ email: 'manager@laracineschool.rw', password: defaultPassword, firstName: 'Admin', lastName: 'Manager', role: 'SCHOOL_MANAGER', phone: '0789000001' });
  await createUser({ email: 'admin@laracineschool.rw', password: defaultPassword, firstName: 'School', lastName: 'Admin', role: 'SCHOOL_ADMIN', phone: '0789000000' });
  await createUser({ email: 'head.studies@laracineschool.rw', password: defaultPassword, firstName: 'Fabrice', lastName: 'Habimana', role: 'HEAD_OF_STUDIES', campusId: campus.id, phone: '0789000002' });
  await createUser({ email: 'head.discipline@laracineschool.rw', password: defaultPassword, firstName: 'Claude', lastName: 'Mugisha', role: 'HEAD_OF_DISCIPLINE', campusId: campus.id, phone: '0789000003' });
  await createUser({ email: 'secretary@laracineschool.rw', password: defaultPassword, firstName: 'Divine', lastName: 'Keza', role: 'SECRETARY', campusId: campus.id, phone: '0789000004' });
  await createUser({ email: 'accountant@laracineschool.rw', password: defaultPassword, firstName: 'Eric', lastName: 'Nshimiyimana', role: 'ACCOUNTANT', campusId: campus.id, phone: '0789000005' });
  await createUser({ email: 'activities@laracineschool.rw', password: defaultPassword, firstName: 'Aline', lastName: 'Uwase', role: 'ACTIVITIES_MANAGER', campusId: campus.id, phone: '0789000007' });
  await createUser({ email: 'librarian@laracineschool.rw', password: defaultPassword, firstName: 'Sandrine', lastName: 'Mukeshimana', role: 'LIBRARIAN', campusId: campus.id, phone: '0789000006' });
  await createUser({ email: 'teacher@laracineschool.rw', password: defaultPassword, firstName: 'Jean Baptiste', lastName: 'N.', role: 'TEACHER', campusId: campus.id, teacherId: teachers[0].id, phone: '0788000101' });
  await createUser({ email: 'parent@laracineschool.rw', password: defaultPassword, firstName: 'Grace', lastName: 'Mukamana', role: 'PARENT', campusId: campus.id, parentId: parent1.id, phone: '0788111001' });
  if (alice) {
    await createUser({ email: 'student@laracineschool.rw', password: defaultPassword, firstName: 'Alice', lastName: 'Mukamana', role: 'STUDENT', campusId: campus.id, studentId: alice.id });
  }

  const secretaryUser = await prisma.user.findFirst({ where: { email: 'secretary@laracineschool.rw' } });
  const parentUser = await prisma.user.findFirst({ where: { email: 'parent@laracineschool.rw' } });
  await seedCommunicationDemo(prisma, { campus, year, secretaryUser, parentUser, alice });

  await prisma.book.createMany({
    data: [
      { campusId: campus.id, title: 'Mathematics for Primary 5', author: 'Rwanda Education Board', category: 'Textbook', copies: 10, available: 10 },
      { campusId: campus.id, title: 'English Reader Level 5', author: 'Cambridge', category: 'Textbook', copies: 8, available: 8 },
      { campusId: campus.id, title: 'Science Adventures', author: 'Patrick M.', category: 'Reference', copies: 5, available: 5 },
    ],
  });

  await prisma.timetableSlot.createMany({
    data: [
      { campusId: campus.id, academicYearId: year.id, classId: p5a.id, subjectId: mathP5?.id, dayOfWeek: 0, startTime: '07:30', endTime: '08:10', room: 'P5-A' },
      { campusId: campus.id, academicYearId: year.id, classId: p5a.id, subjectId: subjects.find((s) => s.code === 'ENG' && s.classId === p5a.id)?.id, dayOfWeek: 1, startTime: '08:10', endTime: '08:50', room: 'P5-A' },
      { campusId: campus.id, academicYearId: year.id, classId: p5a.id, subjectId: subjects.find((s) => s.code === 'SCI' && s.classId === p5a.id)?.id, dayOfWeek: 2, startTime: '10:00', endTime: '10:40', room: 'Lab' },
      { campusId: campus.id, academicYearId: year.id, classId: p5a.id, subjectId: mathP5?.id, dayOfWeek: 3, startTime: '10:40', endTime: '11:20', room: 'P5-A' },
      { campusId: campus.id, academicYearId: year.id, classId: p5a.id, subjectId: subjects.find((s) => s.code === 'ENG' && s.classId === p5a.id)?.id, dayOfWeek: 4, startTime: '13:30', endTime: '14:10', room: 'P5-A' },
    ],
  });

  const football = await prisma.extracurricularActivity.create({
    data: {
      campusId: campus.id,
      academicYearId: year.id,
      name: 'Football Club',
      description: 'After-school football training for Primary students.',
      category: 'Sport',
      schedule: 'Tuesday & Thursday 15:30',
      location: 'Sports field',
      instructor: 'Coach Patrick',
      maxStudents: 30,
      allowedGrades: ['P4', 'P5', 'P6'],
    },
  });
  const chess = await prisma.extracurricularActivity.create({
    data: {
      campusId: campus.id,
      academicYearId: year.id,
      name: 'Chess Club',
      description: 'Learn strategy and compete in friendly matches.',
      category: 'Other',
      schedule: 'Friday 14:00',
      location: 'P5-A classroom',
      allowedGrades: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    },
  });
  if (alice) {
    await prisma.extracurricularEnrollment.create({
      data: { activityId: football.id, studentId: alice.id },
    });
  }

  await prisma.homework.createMany({
    data: [
      {
        campusId: campus.id,
        academicYearId: year.id,
        classId: p5a.id,
        subjectId: mathP5?.id,
        title: 'Fractions worksheet — pages 12–15',
        description: 'Complete exercises 1–10 on equivalent fractions.',
        dueDate: new Date('2026-07-18'),
      },
      {
        campusId: campus.id,
        academicYearId: year.id,
        classId: p5a.id,
        subjectId: subjects.find((s) => s.code === 'ENG' && s.classId === p5a.id)?.id,
        title: 'Reading comprehension: "The River"',
        description: 'Read the passage and answer questions 1–5.',
        dueDate: new Date('2026-07-20'),
      },
    ],
  });

  await seedStudentLearningDemo(prisma, { campus, year, p5a });
  await seedInteractiveHomework(prisma, { campus, year });
  await seedOnlineClasses(prisma, { campus, year, p5a, demoStudent: alice });

  console.log('Seeded 2 campuses and demo users.');
  console.log('Manager → /campuses to pick a campus');
  console.log('Other users → auto redirect to Gisenyi campus');
  console.log('Default password: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
