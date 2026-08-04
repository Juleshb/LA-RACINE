import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import campusRoutes from './routes/campuses.js';
import userRoutes from './routes/users.js';
import schoolRoutes from './routes/school.js';
import studentRoutes from './routes/students.js';
import teacherRoutes from './routes/teachers.js';
import classRoutes from './routes/classes.js';
import courseRoutes from './routes/courses.js';
import markRoutes from './routes/marks.js';
import attendanceRoutes from './routes/attendance.js';
import feeRoutes from './routes/fees.js';
import libraryRoutes from './routes/library.js';
import eLibraryRoutes from './routes/eLibrary.js';
import eLearningRoutes from './routes/eLearning.js';
import timetableRoutes from './routes/timetable.js';
import homeworkRoutes from './routes/homework.js';
import onlineClassesRoutes from './routes/onlineClasses.js';
import extracurricularRoutes from './routes/extracurricular.js';
import transportRoutes from './routes/transport.js';
import communicationRoutes from './routes/communication.js';
import reportRoutes from './routes/reports.js';
import parentRoutes from './routes/parent.js';
import teacherPortalRoutes from './routes/teacherPortal.js';
import studentPortalRoutes from './routes/studentPortal.js';
import { authenticate } from './middleware/auth.js';
import { requireCampus } from './middleware/campus.js';
import { enrichUserScope } from './middleware/userScope.js';
import academicYearRoutes from './routes/academicYears.js';
import verifyRoutes from './routes/verify.js';
import publicRoutes from './routes/public.js';
import websiteRoutes from './routes/website.js';
import contactRoutes from './routes/contact.js';
import { requireAcademicYear } from './middleware/academicYear.js';
import { initRealtime } from './lib/realtime.js';
import { ensureCalendarUploadsDir } from './lib/calendarFiles.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

ensureCalendarUploadsDir();
initRealtime(server);

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'École La RACINE API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/contact', contactRoutes);

app.use(authenticate);

app.use('/api/campuses', campusRoutes);
app.use('/api/users', userRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/website', websiteRoutes);

app.use(requireCampus);
app.use(enrichUserScope);
app.use('/api/academic-years', academicYearRoutes);
app.use(requireAcademicYear);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/marks', markRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/e-library', eLibraryRoutes);
app.use('/api/e-learning', eLearningRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/online-classes', onlineClassesRoutes);
app.use('/api/extracurricular', extracurricularRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/teacher', teacherPortalRoutes);
app.use('/api/student', studentPortalRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Upload too large. Each file should be under 5 MB and total submission under 20 MB.',
    });
  }
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
