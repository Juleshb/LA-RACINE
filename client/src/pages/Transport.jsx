import { useEffect, useState, useMemo } from 'react';
import {
  Bus, MapPin, Users, Clock, Bell, Wallet, Plus, Trash2, Pencil, Check,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { useTranslation } from '../context/LanguageContext';

const TABS = [
  { id: 'overview', labelKey: 'pages.transport.tabOverview', icon: Bus },
  { id: 'routes', labelKey: 'pages.transport.tabRoutes', icon: MapPin },
  { id: 'fleet', labelKey: 'pages.transport.tabFleet', icon: Bus },
  { id: 'passengers', labelKey: 'pages.transport.tabPassengers', icon: Users },
  { id: 'attendance', labelKey: 'pages.transport.tabAttendance', icon: Check },
  { id: 'alerts', labelKey: 'pages.transport.tabAlerts', icon: Bell },
  { id: 'fees', labelKey: 'pages.transport.tabFees', icon: Wallet },
];

const BUS_STOPS = [
  'MBUGANGARI', 'MAKORO', 'CENTRE_VILLE', 'MAJENGO', 'RUGERERO', 'BYAHI', 'RCD', 'PETITE_BARRIERE',
];

const ALERT_TYPES = [
  { value: 'DELAY', label: 'Delay' },
  { value: 'ROUTE_CHANGE', label: 'Route change' },
  { value: 'CANCELLATION', label: 'Cancellation' },
  { value: 'GENERAL', label: 'General notice' },
];

const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'NOT_SCHEDULED'];

function formatCurrency(n) {
  return new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', maximumFractionDigits: 0 }).format(n || 0);
}

function formatBusStop(s) {
  return s?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Transport() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const canManage = !['PARENT', 'STUDENT', 'TEACHER'].includes(user?.role);
  const isFamily = ['PARENT', 'STUDENT'].includes(user?.role);
  const isTeacher = user?.role === 'TEACHER';

  const [tab, setTab] = useState(isFamily ? 'overview' : 'overview');
  const [overview, setOverview] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [fees, setFees] = useState([]);
  const [myTransport, setMyTransport] = useState(null);
  const [students, setStudents] = useState([]);

  const [routeFilter, setRouteFilter] = useState('');
  const [passengerList, setPassengerList] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(todayISO());
  const [attendanceDirection, setAttendanceDirection] = useState('MORNING');
  const [attendanceRouteId, setAttendanceRouteId] = useState('');
  const [attendanceRows, setAttendanceRows] = useState([]);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const visibleTabs = isFamily
    ? TABS.filter((t) => ['overview', 'alerts'].includes(t.id))
    : isTeacher
      ? TABS.filter((t) => ['overview', 'routes', 'passengers', 'alerts'].includes(t.id))
      : TABS;

  const loadCore = () => {
    if (isFamily) {
      api.getMyTransport().then(setMyTransport).catch(console.error);
      api.getTransportAlerts().then(setAlerts).catch(console.error);
      return;
    }
    api.getTransportOverview().then(setOverview).catch(console.error);
    api.getTransportRoutes().then(setRoutes).catch(console.error);
    api.getTransportVehicles().then(setVehicles).catch(console.error);
    api.getTransportDrivers().then(setDrivers).catch(console.error);
    api.getTransportAlerts().then(setAlerts).catch(console.error);
    if (canManage) {
      api.getStudents().then(setStudents).catch(console.error);
    }
  };

  const loadPassengers = () => {
    api.getTransportPassengers(routeFilter || undefined).then(setPassengers).catch(console.error);
  };

  const loadFees = () => {
    api.getTransportFees().then(setFees).catch(console.error);
  };

  useEffect(() => { loadCore(); }, []);
  useEffect(() => { if (tab === 'passengers') loadPassengers(); }, [tab, routeFilter]);
  useEffect(() => { if (tab === 'fees') loadFees(); }, [tab]);
  useEffect(() => {
    if (tab === 'attendance' && attendanceRouteId) {
      api.getTransportAttendance(attendanceRouteId, attendanceDate, attendanceDirection)
        .then((rows) => {
          setAttendanceRows(rows.map((r) => ({ ...r, status: r.status || 'PRESENT' })));
        })
        .catch(console.error);
    }
  }, [tab, attendanceRouteId, attendanceDate, attendanceDirection]);

  const openModal = (type, data = {}) => {
    setModal(type);
    setForm(data);
    setError('');
  };

  const closeModal = () => {
    setModal(null);
    setForm({});
    setError('');
    setSubmitting(false);
  };

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createTransportRoute({
        name: form.name,
        code: form.code,
        description: form.description,
        stops: form.stops || [],
      });
      closeModal();
      loadCore();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStop = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.addTransportStop(form.routeId, form);
      closeModal();
      loadCore();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createTransportSchedule(form);
      closeModal();
      loadCore();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignPassenger = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.assignTransportPassenger(form);
      closeModal();
      loadPassengers();
      loadCore();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAlert = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await api.createTransportAlert(form);
      alert(`Alert sent. ${result.parentsNotified} parent(s) will be notified in the app.`);
      closeModal();
      loadCore();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAttendance = async () => {
    try {
      await api.saveTransportAttendance({
        routeId: attendanceRouteId,
        date: attendanceDate,
        direction: attendanceDirection,
        records: attendanceRows.map((r) => ({ studentId: r.studentId, status: r.status })),
      });
      alert('Transport attendance saved');
    } catch (err) {
      alert(err.message);
    }
  };

  const loadPassengerList = async (routeId) => {
    const data = await api.getTransportPassengerList(routeId);
    setPassengerList(data);
  };

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === form.routeId || r.id === routeFilter),
    [routes, form.routeId, routeFilter],
  );

  const routeStops = selectedRoute?.stops || routes.find((r) => r.id === form.routeId)?.stops || [];

  return (
    <div className="transport-page">
      <PageHeader
        title={isFamily
          ? t('pages.transport.titleFamily')
          : isTeacher
            ? t('pages.transport.titleTeacher')
            : t('pages.transport.title')}
        description={isFamily
          ? t('pages.transport.descriptionFamily')
          : isTeacher
            ? t('pages.transport.descriptionTeacher')
            : t('pages.transport.description')}
        action={canManage && tab === 'alerts' && (
          <button type="button" className="btn-primary flex items-center gap-2" onClick={() => openModal('alert', { type: 'DELAY', notifyParents: true })}>
            <Bell className="w-4 h-4" />
            {t('pages.transport.sendAlert')}
          </button>
        )}
      />

      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 print:hidden">
        {visibleTabs.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Family view */}
      {isFamily && tab === 'overview' && (
        <div className="space-y-6">
          {myTransport?.alerts?.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                {t('pages.transport.recentNotices')}
              </h3>
              {myTransport.alerts.map((a) => (
                <div key={a.id} className="card p-4 border-l-4 border-l-amber-400">
                  <p className="font-semibold text-sm">{a.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{a.message}</p>
                  {a.delayMinutes && <p className="text-xs text-amber-700 mt-1">Delay: {a.delayMinutes} min</p>}
                  {a.route && <p className="text-xs text-gray-400 mt-1">Route: {a.route.name}</p>}
                </div>
              ))}
            </div>
          )}
          {myTransport?.students?.length === 0 && (
            <div className="card empty-state py-12">
              <Bus className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-gray-600">{t('pages.transport.noAssignment')}</p>
            </div>
          )}
          {myTransport?.students?.map((s) => {
            const t = s.transportEnrollment;
            if (!t) return null;
            return (
              <div key={s.id} className="card p-5">
                <h3 className="font-bold text-lg">{s.firstName} {s.lastName}</h3>
                <p className="text-sm text-gray-500 mb-4">{s.class?.name}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase text-gray-400 font-semibold">Route</p>
                    <p className="font-medium">{t.route.name} ({t.route.code})</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 font-semibold">Pickup / Drop-off</p>
                    <p className="font-medium">{t.stop.name}</p>
                    <p className="text-gray-500 text-xs">
                      AM {t.stop.pickupTime || '—'} · PM {t.stop.dropoffTime || '—'}
                    </p>
                  </div>
                </div>
                {t.route.schedules?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Schedule</p>
                    {t.route.schedules.map((sch) => (
                      <p key={sch.id} className="text-sm text-gray-600">
                        {sch.direction} {sch.departureTime}
                        {sch.vehicle && ` · ${sch.vehicle.plateNumber}`}
                        {sch.driver && ` · ${sch.driver.name}`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Admin overview */}
      {!isFamily && tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { labelKey: 'pages.transport.activeRoutes', value: overview.routes, icon: MapPin },
              { labelKey: 'pages.transport.tabPassengers', value: overview.passengers, icon: Users },
              { labelKey: 'pages.transport.vehicles', value: overview.vehicles, icon: Bus },
              { labelKey: 'pages.transport.drivers', value: overview.drivers, icon: Users },
            ].map(({ labelKey, value, icon: Icon }) => (
              <div key={labelKey} className="card p-4">
                <Icon className="w-5 h-5 text-brand-600 mb-2" />
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-gray-500">{t(labelKey)}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-sm font-semibold text-gray-700 mb-1">Transport fees</p>
              <p className="text-xl font-bold">{formatCurrency(overview.transportFeesCollected)}</p>
              <p className="text-xs text-gray-400">collected of {formatCurrency(overview.transportFeesTotal)} billed</p>
            </div>
            <div className="card p-4">
              <p className="text-sm font-semibold text-gray-700 mb-1">Alerts (7 days)</p>
              <p className="text-xl font-bold">{overview.recentAlerts}</p>
            </div>
          </div>
          {alerts.slice(0, 5).map((a) => (
            <div key={a.id} className="card p-3 border-l-4 border-l-amber-400 text-sm">
              <strong>{a.title}</strong> — {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Routes */}
      {!isFamily && tab === 'routes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" className="btn-primary flex items-center gap-2" onClick={() => openModal('route', { stops: [{ name: '', pickupTime: '07:00', dropoffTime: '16:30' }] })}>
              <Plus className="w-4 h-4" /> {t('pages.transport.newRoute')}
            </button>
          </div>
          {routes.map((route) => (
            <div key={route.id} className="card p-4">
              <div className="flex flex-wrap justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-bold">{route.name} <span className="text-gray-400 font-normal">({route.code})</span></h3>
                  <p className="text-sm text-gray-500">{route._count?.enrollments || 0} passengers</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => openModal('stop', { routeId: route.id })}>{t('pages.transport.addStop')}</button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => openModal('schedule', { routeId: route.id, direction: 'MORNING', departureTime: '07:00' })}>{t('pages.transport.addSchedule')}</button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => loadPassengerList(route.id)}>{t('pages.transport.passengerList')}</button>
                  {canManage && (
                    <button type="button" className="btn-secondary text-sm text-red-600" onClick={async () => { if (confirm(t('pages.transport.deleteRouteConfirm'))) { await api.deleteTransportRoute(route.id); loadCore(); } }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b">
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Stop</th>
                      <th className="py-2 pr-4">Pickup</th>
                      <th className="py-2 pr-4">Drop-off</th>
                    </tr>
                  </thead>
                  <tbody>
                    {route.stops.map((stop, i) => (
                      <tr key={stop.id} className="border-b border-gray-50">
                        <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                        <td className="py-2 pr-4 font-medium">{stop.name}</td>
                        <td className="py-2 pr-4">{stop.pickupTime || '—'}</td>
                        <td className="py-2 pr-4">{stop.dropoffTime || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {route.schedules?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
                  {route.schedules.map((s) => (
                    <p key={s.id}>
                      <Clock className="w-3 h-3 inline mr-1" />
                      {s.direction}: {s.departureTime}
                      {s.vehicle && ` · ${s.vehicle.plateNumber}`}
                      {s.driver && ` · ${s.driver.name} (${s.driver.phone})`}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
          {passengerList && (
            <div className="card p-4 mt-4">
              <div className="flex justify-between mb-3">
                <h3 className="font-bold">Passenger list — {passengerList.route.name}</h3>
                <button type="button" className="text-sm text-gray-500" onClick={() => setPassengerList(null)}>Close</button>
              </div>
              <p className="text-sm text-gray-500 mb-4">{passengerList.totalPassengers} students</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {passengerList.byStop.map(({ stop, passengers: pax }) => (
                  <div key={stop.id} className="rounded-lg border p-3">
                    <p className="font-semibold text-sm mb-2">{stop.name}</p>
                    {pax.length === 0 ? <p className="text-xs text-gray-400">No students</p> : (
                      <ul className="text-sm space-y-1">
                        {pax.map((p) => <li key={p.studentId}>{p.name} <span className="text-gray-400">({p.className})</span></li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fleet */}
      {!isFamily && tab === 'fleet' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Vehicles</h3>
              <button type="button" className="btn-secondary text-sm" onClick={() => openModal('vehicle', { capacity: 30 })}>Add vehicle</button>
            </div>
            {vehicles.map((v) => (
              <div key={v.id} className="card p-3 mb-2 flex justify-between">
                <div>
                  <p className="font-bold">{v.plateNumber}</p>
                  <p className="text-sm text-gray-500">{v.label || 'Bus'} · {v.capacity} seats</p>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Drivers</h3>
              <button type="button" className="btn-secondary text-sm" onClick={() => openModal('driver', {})}>Add driver</button>
            </div>
            {drivers.map((d) => (
              <div key={d.id} className="card p-3 mb-2">
                <p className="font-bold">{d.name}</p>
                <p className="text-sm text-gray-500">{d.phone}{d.licenseNumber && ` · ${d.licenseNumber}`}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Passengers */}
      {!isFamily && tab === 'passengers' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div>
              <label className="label">Filter route</label>
              <select className="input" value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}>
                <option value="">All routes</option>
                {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {canManage && (
              <button type="button" className="btn-primary flex items-center gap-2" onClick={() => openModal('passenger', { routeId: routeFilter || routes[0]?.id })}>
                <Plus className="w-4 h-4" /> Assign student
              </button>
            )}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b">
                  <th className="p-3">Student</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Stop</th>
                  <th className="p-3">Monthly fee</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {passengers.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="p-3 font-medium">{p.student.firstName} {p.student.lastName}</td>
                    <td className="p-3">{p.student.class?.name}</td>
                    <td className="p-3">{p.route.name}</td>
                    <td className="p-3">{p.stop.name}</td>
                    <td className="p-3">{p.monthlyFee ? formatCurrency(p.monthlyFee) : '—'}</td>
                    <td className="p-3">
                      {canManage && (
                        <button type="button" className="text-red-500 text-xs" onClick={async () => { if (confirm('Remove?')) { await api.removeTransportPassenger(p.studentId); loadPassengers(); } }}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance */}
      {!isFamily && tab === 'attendance' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="label">Route</label>
              <select className="input" value={attendanceRouteId} onChange={(e) => setAttendanceRouteId(e.target.value)}>
                <option value="">Select route</option>
                {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Trip</label>
              <select className="input" value={attendanceDirection} onChange={(e) => setAttendanceDirection(e.target.value)}>
                <option value="MORNING">Morning pickup</option>
                <option value="EVENING">Evening drop-off</option>
              </select>
            </div>
          </div>
          {attendanceRouteId && (
            <>
              <div className="card overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b">
                      <th className="p-3">Student</th>
                      <th className="p-3">Class</th>
                      <th className="p-3">Stop</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.map((row, i) => (
                      <tr key={row.studentId} className="border-b border-gray-50">
                        <td className="p-3">{row.name}</td>
                        <td className="p-3">{row.className}</td>
                        <td className="p-3">{row.stopName}</td>
                        <td className="p-3">
                          <select
                            className="input input-sm"
                            value={row.status}
                            onChange={(e) => {
                              const next = [...attendanceRows];
                              next[i] = { ...row, status: e.target.value };
                              setAttendanceRows(next);
                            }}
                          >
                            {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn-primary" onClick={handleSaveAttendance}>Save attendance</button>
            </>
          )}
        </div>
      )}

      {/* Alerts */}
      {tab === 'alerts' && (
        <div className="space-y-3">
          {canManage && (
            <button type="button" className="btn-primary mb-4 flex items-center gap-2" onClick={() => openModal('alert', { type: 'DELAY', notifyParents: true })}>
              <Bell className="w-4 h-4" /> Notify parents
            </button>
          )}
          {alerts.map((a) => (
            <div key={a.id} className={`card p-4 border-l-4 ${
              a.type === 'DELAY' ? 'border-l-amber-500' : a.type === 'CANCELLATION' ? 'border-l-red-500' : 'border-l-blue-500'
            }`}>
              <div className="flex flex-wrap gap-2 mb-1">
                <span className="text-xs font-bold uppercase text-gray-400">{a.type.replace('_', ' ')}</span>
                {a.route && <span className="text-xs text-gray-500">Route: {a.route.name}</span>}
              </div>
              <p className="font-semibold">{a.title}</p>
              <p className="text-sm text-gray-600 mt-1">{a.message}</p>
              {a.delayMinutes && <p className="text-sm text-amber-700 mt-1">Estimated delay: {a.delayMinutes} minutes</p>}
              <p className="text-xs text-gray-400 mt-2">{new Date(a.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Fees */}
      {!isFamily && tab === 'fees' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b">
                <th className="p-3">Student</th>
                <th className="p-3">Class</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Due</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id} className="border-b border-gray-50">
                  <td className="p-3">{f.student.firstName} {f.student.lastName}</td>
                  <td className="p-3">{f.student.class?.name}</td>
                  <td className="p-3">{formatCurrency(f.amount)}</td>
                  <td className="p-3">{new Date(f.dueDate).toLocaleDateString()}</td>
                  <td className="p-3"><span className={`badge ${f.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>{f.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <FormModeModal open={modal === 'route'} mode="create" title="New bus route" onClose={closeModal} onSubmit={handleCreateRoute} formId="route-form" submitLabel="Create route" submitting={submitting} error={error}>
        <FormSection title="Route">
          <div><label className="label">Name *</label><input className="input" required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Route A — Rubavu" /></div>
          <div><label className="label">Code *</label><input className="input" required value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="RT-A" /></div>
          <div className="form-field-full md:col-span-2">
            <label className="label">First stop (add more after creating)</label>
            <input className="input" value={form.stops?.[0]?.name || ''} onChange={(e) => setForm({ ...form, stops: [{ ...form.stops?.[0], name: e.target.value, pickupTime: form.stops?.[0]?.pickupTime || '07:00', dropoffTime: form.stops?.[0]?.dropoffTime || '16:30' }] })} placeholder="Stop name" />
          </div>
        </FormSection>
      </FormModeModal>

      <FormModeModal open={modal === 'stop'} mode="create" title="Add pickup/drop-off point" onClose={closeModal} onSubmit={handleAddStop} formId="stop-form" submitLabel="Add stop" submitting={submitting} error={error}>
        <FormSection title="Stop">
          <div><label className="label">Stop name *</label><input className="input" required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Pickup time</label><input className="input" type="time" value={form.pickupTime || ''} onChange={(e) => setForm({ ...form, pickupTime: e.target.value })} /></div>
          <div><label className="label">Drop-off time</label><input className="input" type="time" value={form.dropoffTime || ''} onChange={(e) => setForm({ ...form, dropoffTime: e.target.value })} /></div>
          <div>
            <label className="label">Legacy bus stop</label>
            <select className="input" value={form.legacyBusStop || ''} onChange={(e) => setForm({ ...form, legacyBusStop: e.target.value || null })}>
              <option value="">None</option>
              {BUS_STOPS.map((s) => <option key={s} value={s}>{formatBusStop(s)}</option>)}
            </select>
          </div>
        </FormSection>
      </FormModeModal>

      <FormModeModal open={modal === 'schedule'} mode="create" title="Transport schedule" onClose={closeModal} onSubmit={handleSchedule} formId="sched-form" submitLabel="Save schedule" submitting={submitting} error={error}>
        <FormSection title="Schedule">
          <div>
            <label className="label">Direction</label>
            <select className="input" value={form.direction || 'MORNING'} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="MORNING">Morning pickup</option>
              <option value="EVENING">Evening drop-off</option>
            </select>
          </div>
          <div><label className="label">Departure *</label><input className="input" type="time" required value={form.departureTime || ''} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} /></div>
          <div>
            <label className="label">Vehicle</label>
            <select className="input" value={form.vehicleId || ''} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Select vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Driver</label>
            <select className="input" value={form.driverId || ''} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">Select driver</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </FormSection>
      </FormModeModal>

      <FormModeModal open={modal === 'passenger'} mode="create" title="Assign student to bus" onClose={closeModal} onSubmit={handleAssignPassenger} formId="pass-form" submitLabel="Assign" submitting={submitting} error={error}>
        <FormSection title="Assignment">
          <div>
            <label className="label">Student *</label>
            <select className="input" required value={form.studentId || ''} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} — {s.class?.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Route *</label>
            <select className="input" required value={form.routeId || ''} onChange={(e) => setForm({ ...form, routeId: e.target.value, stopId: '' })}>
              <option value="">Select route</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Pickup / drop-off stop *</label>
            <select className="input" required value={form.stopId || ''} onChange={(e) => setForm({ ...form, stopId: e.target.value })}>
              <option value="">Select stop</option>
              {(routes.find((r) => r.id === form.routeId)?.stops || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Monthly transport fee (RWF)</label>
            <input className="input" type="number" value={form.monthlyFee || ''} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} placeholder="Optional — creates fee record" />
          </div>
        </FormSection>
      </FormModeModal>

      <FormModeModal open={modal === 'vehicle'} mode="create" title="Add vehicle" onClose={closeModal} onSubmit={async (e) => { e.preventDefault(); setSubmitting(true); try { await api.createTransportVehicle(form); closeModal(); loadCore(); } catch (err) { setError(err.message); } finally { setSubmitting(false); } }} formId="veh-form" submitLabel="Add" submitting={submitting} error={error}>
        <FormSection title="Vehicle">
          <div><label className="label">Plate number *</label><input className="input" required value={form.plateNumber || ''} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} /></div>
          <div><label className="label">Label</label><input className="input" value={form.label || ''} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Bus 1" /></div>
          <div><label className="label">Capacity</label><input className="input" type="number" value={form.capacity || 30} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
        </FormSection>
      </FormModeModal>

      <FormModeModal open={modal === 'driver'} mode="create" title="Add driver" onClose={closeModal} onSubmit={async (e) => { e.preventDefault(); setSubmitting(true); try { await api.createTransportDriver(form); closeModal(); loadCore(); } catch (err) { setError(err.message); } finally { setSubmitting(false); } }} formId="drv-form" submitLabel="Add" submitting={submitting} error={error}>
        <FormSection title="Driver">
          <div><label className="label">Name *</label><input className="input" required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Phone *</label><input className="input" required value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">License</label><input className="input" value={form.licenseNumber || ''} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} /></div>
        </FormSection>
      </FormModeModal>

      <FormModeModal open={modal === 'alert'} mode="create" title="Notify parents" subtitle="Parents see alerts when they open Transport" onClose={closeModal} onSubmit={handleAlert} formId="alert-form" submitLabel="Send alert" submitting={submitting} error={error}>
        <FormSection title="Alert">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type || 'DELAY'} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {ALERT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Route (optional)</label>
            <select className="input" value={form.routeId || ''} onChange={(e) => setForm({ ...form, routeId: e.target.value || null })}>
              <option value="">All routes / campus-wide</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-field-full md:col-span-2"><label className="label">Title *</label><input className="input" required value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="form-field-full md:col-span-2"><label className="label">Message *</label><textarea className="input" required rows={3} value={form.message || ''} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          {form.type === 'DELAY' && (
            <div><label className="label">Delay (minutes)</label><input className="input" type="number" value={form.delayMinutes || ''} onChange={(e) => setForm({ ...form, delayMinutes: e.target.value })} /></div>
          )}
        </FormSection>
      </FormModeModal>
    </div>
  );
}
