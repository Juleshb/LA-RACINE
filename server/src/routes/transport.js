import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { campusYearWhere, studentScopeWhere, teacherStudentIdsForReq } from '../lib/scope.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.TRANSPORT));

function canManage(role) {
  return !['PARENT', 'STUDENT', 'TEACHER'].includes(role);
}

function generateReceiptNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const r = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `FEE-${y}${m}-${r}`;
}

async function parentRouteIds(req) {
  if (!req.user.parentId) return [];
  const enrollments = await prisma.studentTransport.findMany({
    where: {
      isActive: true,
      student: { parentId: req.user.parentId, ...campusYearWhere(req) },
    },
    select: { routeId: true },
  });
  return [...new Set(enrollments.map((e) => e.routeId))];
}

async function studentRouteId(req) {
  if (!req.user.studentId) return null;
  const enrollment = await prisma.studentTransport.findFirst({
    where: { studentId: req.user.studentId, isActive: true },
    select: { routeId: true },
  });
  return enrollment?.routeId || null;
}

async function teacherRouteIds(req) {
  if (req.user.role !== 'TEACHER') return null;
  const scope = await studentScopeWhere(req);
  const enrollments = await prisma.studentTransport.findMany({
    where: { isActive: true, student: scope },
    select: { routeId: true },
  });
  return [...new Set(enrollments.map((e) => e.routeId))];
}

// ─── Overview ───────────────────────────────────────────────────────────────

router.get('/overview', async (req, res) => {
  try {
    const base = campusYearWhere(req);
    const isTeacher = req.user.role === 'TEACHER';
    const teacherRoutes = isTeacher ? await teacherRouteIds(req) : null;
    const teacherStudentIds = isTeacher ? await teacherStudentIdsForReq(req) : null;

    const routeWhere = {
      ...base,
      isActive: true,
      ...(teacherRoutes ? { id: { in: teacherRoutes.length ? teacherRoutes : [] } } : {}),
    };
    const passengerWhere = {
      ...base,
      isActive: true,
      ...(teacherStudentIds ? { studentId: { in: teacherStudentIds.length ? teacherStudentIds : [] } } : {}),
    };

    const [routes, vehicles, drivers, passengers, alerts] = await Promise.all([
      prisma.transportRoute.count({ where: routeWhere }),
      isTeacher ? Promise.resolve(0) : prisma.transportVehicle.count({ where: { campusId: req.campusId, isActive: true } }),
      isTeacher ? Promise.resolve(0) : prisma.transportDriver.count({ where: { campusId: req.campusId, isActive: true } }),
      prisma.studentTransport.count({ where: passengerWhere }),
      prisma.transportAlert.count({
        where: {
          ...base,
          effectiveDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          ...(teacherRoutes?.length ? { OR: [{ routeId: null }, { routeId: { in: teacherRoutes } }] } : {}),
        },
      }),
    ]);

    const transportFees = await prisma.feePayment.aggregate({
      where: {
        feeType: 'TRANSPORT',
        ...(teacherStudentIds ? { studentId: { in: teacherStudentIds.length ? teacherStudentIds : [] } } : { student: { ...base } }),
      },
      _sum: { amount: true },
      _count: true,
    });

    const paidTransportFees = await prisma.feePayment.aggregate({
      where: {
        feeType: 'TRANSPORT',
        status: 'PAID',
        ...(teacherStudentIds ? { studentId: { in: teacherStudentIds.length ? teacherStudentIds : [] } } : { student: { ...base } }),
      },
      _sum: { amount: true },
    });

    res.json({
      routes,
      vehicles,
      drivers,
      passengers,
      recentAlerts: alerts,
      transportFeesTotal: transportFees._sum.amount || 0,
      transportFeesCount: transportFees._count,
      transportFeesCollected: paidTransportFees._sum.amount || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/routes', async (req, res) => {
  try {
    const teacherRoutes = await teacherRouteIds(req);
    const routes = await prisma.transportRoute.findMany({
      where: {
        ...campusYearWhere(req),
        ...(teacherRoutes ? { id: { in: teacherRoutes.length ? teacherRoutes : [] } } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        stops: { orderBy: { sortOrder: 'asc' } },
        schedules: {
          include: {
            vehicle: { select: { id: true, plateNumber: true, label: true } },
            driver: { select: { id: true, name: true, phone: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    });
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/routes', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const { name, code, description, stops = [] } = req.body;
    if (!name?.trim() || !code?.trim()) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const route = await prisma.transportRoute.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description || null,
        stops: {
          create: stops.map((s, i) => ({
            name: s.name,
            address: s.address || null,
            sortOrder: s.sortOrder ?? i,
            pickupTime: s.pickupTime || null,
            dropoffTime: s.dropoffTime || null,
            legacyBusStop: s.legacyBusStop || null,
          })),
        },
      },
      include: { stops: { orderBy: { sortOrder: 'asc' } } },
    });
    res.status(201).json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/routes/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const existing = await prisma.transportRoute.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Route not found' });

    const { name, code, description, isActive } = req.body;
    const route = await prisma.transportRoute.update({
      where: { id: req.params.id },
      data: {
        name: name?.trim() ?? existing.name,
        code: code?.trim().toUpperCase() ?? existing.code,
        description: description ?? existing.description,
        isActive: isActive ?? existing.isActive,
      },
      include: {
        stops: { orderBy: { sortOrder: 'asc' } },
        schedules: { include: { vehicle: true, driver: true } },
        _count: { select: { enrollments: true } },
      },
    });
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/routes/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const existing = await prisma.transportRoute.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Route not found' });
    await prisma.transportRoute.delete({ where: { id: req.params.id } });
    res.json({ message: 'Route deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Stops ──────────────────────────────────────────────────────────────────

router.post('/routes/:routeId/stops', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const route = await prisma.transportRoute.findFirst({
      where: { id: req.params.routeId, ...campusYearWhere(req) },
    });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const { name, address, sortOrder, pickupTime, dropoffTime, legacyBusStop } = req.body;
    const maxOrder = await prisma.transportStop.aggregate({
      where: { routeId: route.id },
      _max: { sortOrder: true },
    });

    const stop = await prisma.transportStop.create({
      data: {
        routeId: route.id,
        name,
        address: address || null,
        sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
        pickupTime: pickupTime || null,
        dropoffTime: dropoffTime || null,
        legacyBusStop: legacyBusStop || null,
      },
    });
    res.status(201).json(stop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/stops/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const stop = await prisma.transportStop.findFirst({
      where: { id: req.params.id, route: campusYearWhere(req) },
    });
    if (!stop) return res.status(404).json({ error: 'Stop not found' });

    const updated = await prisma.transportStop.update({
      where: { id: stop.id },
      data: req.body,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/stops/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const stop = await prisma.transportStop.findFirst({
      where: { id: req.params.id, route: campusYearWhere(req) },
    });
    if (!stop) return res.status(404).json({ error: 'Stop not found' });
    await prisma.transportStop.delete({ where: { id: stop.id } });
    res.json({ message: 'Stop deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Vehicles & Drivers ─────────────────────────────────────────────────────

router.get('/vehicles', async (req, res) => {
  try {
    if (req.user.role === 'TEACHER') return res.json([]);
    const vehicles = await prisma.transportVehicle.findMany({
      where: { campusId: req.campusId },
      orderBy: { plateNumber: 'asc' },
    });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vehicles', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const { plateNumber, label, capacity } = req.body;
    const vehicle = await prisma.transportVehicle.create({
      data: {
        campusId: req.campusId,
        plateNumber: plateNumber.trim().toUpperCase(),
        label: label || null,
        capacity: capacity ? Number(capacity) : 30,
      },
    });
    res.status(201).json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/vehicles/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const vehicle = await prisma.transportVehicle.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/drivers', async (req, res) => {
  try {
    if (req.user.role === 'TEACHER') return res.json([]);
    const drivers = await prisma.transportDriver.findMany({
      where: { campusId: req.campusId },
      orderBy: { name: 'asc' },
    });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/drivers', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const { name, phone, licenseNumber } = req.body;
    const driver = await prisma.transportDriver.create({
      data: { campusId: req.campusId, name, phone, licenseNumber: licenseNumber || null },
    });
    res.status(201).json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/drivers/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const driver = await prisma.transportDriver.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Schedules ──────────────────────────────────────────────────────────────

router.post('/schedules', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const { routeId, vehicleId, driverId, direction, departureTime, arrivalTime, daysOfWeek } = req.body;

    const route = await prisma.transportRoute.findFirst({
      where: { id: routeId, ...campusYearWhere(req) },
    });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const schedule = await prisma.transportSchedule.create({
      data: {
        routeId,
        vehicleId: vehicleId || null,
        driverId: driverId || null,
        direction,
        departureTime,
        arrivalTime: arrivalTime || null,
        daysOfWeek: daysOfWeek || [0, 1, 2, 3, 4],
      },
      include: { vehicle: true, driver: true },
    });
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/schedules/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const schedule = await prisma.transportSchedule.update({
      where: { id: req.params.id },
      data: req.body,
      include: { vehicle: true, driver: true, route: true },
    });
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/schedules/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    await prisma.transportSchedule.delete({ where: { id: req.params.id } });
    res.json({ message: 'Schedule deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Passengers ─────────────────────────────────────────────────────────────

router.get('/passengers', async (req, res) => {
  try {
    const { routeId } = req.query;
    const scope = await studentScopeWhere(req);

    const where = {
      ...campusYearWhere(req),
      isActive: true,
      ...(routeId ? { routeId } : {}),
      student: scope,
    };

    const passengers = await prisma.studentTransport.findMany({
      where,
      include: {
        student: {
          include: { class: { select: { name: true, grade: true, section: true } } },
        },
        route: { select: { id: true, name: true, code: true } },
        stop: true,
      },
      orderBy: [{ route: { name: 'asc' } }, { stop: { sortOrder: 'asc' } }],
    });

    res.json(passengers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/routes/:routeId/passenger-list', async (req, res) => {
  try {
    const route = await prisma.transportRoute.findFirst({
      where: { id: req.params.routeId, ...campusYearWhere(req) },
      include: {
        stops: { orderBy: { sortOrder: 'asc' } },
        schedules: { include: { vehicle: true, driver: true } },
      },
    });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const passengers = await prisma.studentTransport.findMany({
      where: { routeId: route.id, isActive: true },
      include: {
        student: {
          include: { class: { select: { name: true, grade: true, section: true } } },
        },
        stop: true,
      },
      orderBy: { stop: { sortOrder: 'asc' } },
    });

    const byStop = route.stops.map((stop) => ({
      stop,
      passengers: passengers
        .filter((p) => p.stopId === stop.id)
        .map((p) => ({
          id: p.id,
          studentId: p.student.id,
          schoolId: p.student.studentId,
          name: `${p.student.firstName} ${p.student.lastName}`.trim(),
          className: p.student.class?.name,
          parentPhone: p.student.parentPhone,
        })),
    }));

    res.json({ route, schedules: route.schedules, byStop, totalPassengers: passengers.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/passengers', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const { studentId, routeId, stopId, monthlyFee } = req.body;

    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: studentId, ...scope },
      include: { class: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const route = await prisma.transportRoute.findFirst({
      where: { id: routeId, ...campusYearWhere(req) },
    });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const stop = await prisma.transportStop.findFirst({
      where: { id: stopId, routeId },
    });
    if (!stop) return res.status(404).json({ error: 'Stop not found on this route' });

    const enrollment = await prisma.studentTransport.upsert({
      where: { studentId },
      create: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        studentId,
        routeId,
        stopId,
        monthlyFee: monthlyFee ? Number(monthlyFee) : null,
      },
      update: {
        routeId,
        stopId,
        monthlyFee: monthlyFee ? Number(monthlyFee) : null,
        isActive: true,
        endDate: null,
      },
      include: {
        student: { include: { class: true } },
        route: true,
        stop: true,
      },
    });

    await prisma.student.update({
      where: { id: studentId },
      data: {
        transportMode: 'SCHOOL',
        busStop: stop.legacyBusStop || student.busStop,
      },
    });

    if (monthlyFee) {
      const existingFee = await prisma.feePayment.findFirst({
        where: {
          studentId,
          feeType: 'TRANSPORT',
          status: { in: ['PENDING', 'OVERDUE'] },
        },
      });
      if (!existingFee) {
        const due = new Date();
        due.setDate(1);
        due.setMonth(due.getMonth() + 1);
        await prisma.feePayment.create({
          data: {
            receiptNumber: generateReceiptNumber(),
            studentId,
            feeType: 'TRANSPORT',
            amount: Number(monthlyFee),
            dueDate: due,
            status: 'PENDING',
            notes: `School transport — ${route.name}`,
          },
        });
      }
    }

    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/passengers/:studentId', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    await prisma.studentTransport.updateMany({
      where: { studentId: req.params.studentId, ...campusYearWhere(req) },
      data: { isActive: false, endDate: new Date() },
    });
    await prisma.student.update({
      where: { id: req.params.studentId },
      data: { transportMode: 'NONE' },
    });
    res.json({ message: 'Student removed from transport' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Attendance ─────────────────────────────────────────────────────────────

router.get('/attendance', async (req, res) => {
  try {
    const { routeId, date, direction } = req.query;
    if (!routeId || !date || !direction) {
      return res.status(400).json({ error: 'routeId, date, and direction are required' });
    }

    const day = new Date(date);
    const passengers = await prisma.studentTransport.findMany({
      where: { routeId, isActive: true },
      include: {
        student: { include: { class: { select: { name: true } } } },
        stop: true,
      },
    });

    const records = await prisma.transportAttendance.findMany({
      where: {
        routeId,
        direction,
        date: day,
      },
    });

    const recordMap = new Map(records.map((r) => [r.studentId, r]));

    res.json(passengers.map((p) => ({
      studentId: p.studentId,
      name: `${p.student.firstName} ${p.student.lastName}`.trim(),
      className: p.student.class?.name,
      stopName: p.stop.name,
      status: recordMap.get(p.studentId)?.status || null,
      recordId: recordMap.get(p.studentId)?.id || null,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/attendance', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const { routeId, date, direction, records, scheduleId } = req.body;
    const day = new Date(date);

    for (const row of records) {
      await prisma.transportAttendance.upsert({
        where: {
          studentId_date_direction: {
            studentId: row.studentId,
            date: day,
            direction,
          },
        },
        create: {
          studentId: row.studentId,
          routeId,
          scheduleId: scheduleId || null,
          date: day,
          direction,
          status: row.status || 'PRESENT',
          notes: row.notes || null,
          recordedById: req.user.id,
        },
        update: {
          status: row.status,
          notes: row.notes || null,
          recordedById: req.user.id,
        },
      });
    }

    res.json({ message: 'Attendance saved', count: records.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Alerts (parent notifications) ──────────────────────────────────────────

router.get('/alerts', async (req, res) => {
  try {
    const base = campusYearWhere(req);
    const { role } = req.user;

    let routeFilter = {};
    if (role === 'PARENT') {
      const routeIds = await parentRouteIds(req);
      routeFilter = {
        OR: [{ routeId: null }, { routeId: { in: routeIds } }],
      };
    } else if (role === 'STUDENT') {
      const routeId = await studentRouteId(req);
      routeFilter = routeId
        ? { OR: [{ routeId: null }, { routeId }] }
        : { routeId: null };
    }

    const alerts = await prisma.transportAlert.findMany({
      where: { ...base, ...routeFilter },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        route: { select: { id: true, name: true, code: true } },
      },
    });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/alerts', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const {
      routeId, type, title, message, delayMinutes, effectiveDate, notifyParents,
    } = req.body;

    const alert = await prisma.transportAlert.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        routeId: routeId || null,
        type,
        title,
        message,
        delayMinutes: delayMinutes ? Number(delayMinutes) : null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        notifyParents: notifyParents !== false,
        createdById: req.user.id,
      },
      include: { route: { select: { name: true, code: true } } },
    });

    let parentsNotified = 0;
    if (notifyParents !== false) {
      const passengerWhere = {
        ...campusYearWhere(req),
        isActive: true,
        ...(routeId ? { routeId } : {}),
        student: { parentId: { not: null } },
      };
      const passengers = await prisma.studentTransport.findMany({
        where: passengerWhere,
        select: { student: { select: { parentId: true, parentPhone: true } } },
      });
      const parentIds = new Set(passengers.map((p) => p.student.parentId).filter(Boolean));
      parentsNotified = parentIds.size;
    }

    res.status(201).json({ alert, parentsNotified });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── My transport (student/parent) ──────────────────────────────────────────

router.get('/my', async (req, res) => {
  try {
    const scope = await studentScopeWhere(req);
    const students = await prisma.student.findMany({
      where: { ...scope, transportEnrollment: { isActive: true } },
      include: {
        class: { select: { name: true } },
        transportEnrollment: {
          include: {
            route: {
              include: {
                stops: { orderBy: { sortOrder: 'asc' } },
                schedules: { include: { vehicle: true, driver: true } },
              },
            },
            stop: true,
          },
        },
      },
    });

    const alertWhere = { ...campusYearWhere(req) };
    if (req.user.role === 'PARENT') {
      const routeIds = await parentRouteIds(req);
      alertWhere.OR = [{ routeId: null }, { routeId: { in: routeIds } }];
    } else if (req.user.role === 'STUDENT') {
      const routeId = await studentRouteId(req);
      alertWhere.OR = routeId ? [{ routeId: null }, { routeId }] : [{ routeId: null }];
    }

    const alerts = await prisma.transportAlert.findMany({
      where: {
        ...alertWhere,
        effectiveDate: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { route: { select: { name: true } } },
    });

    res.json({ students, alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Transport fees ─────────────────────────────────────────────────────────

router.get('/fees', async (req, res) => {
  try {
    const scope = await studentScopeWhere(req);
    const fees = await prisma.feePayment.findMany({
      where: {
        feeType: 'TRANSPORT',
        student: scope,
      },
      orderBy: { dueDate: 'desc' },
      include: {
        student: { include: { class: { select: { name: true } } } },
      },
    });
    res.json(fees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
