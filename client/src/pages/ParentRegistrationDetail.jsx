import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';

const STATUS = {
  PENDING: { icon: Clock, className: 'bg-amber-50 text-amber-700', label: 'Pending review', note: 'The school is reviewing your application. You will be notified when a decision is made.' },
  APPROVED: { icon: CheckCircle, className: 'bg-green-50 text-green-700', label: 'Approved', note: 'Enrollment approved. Next step: create your child\'s student portal login from Child accounts.' },
  REJECTED: { icon: XCircle, className: 'bg-red-50 text-red-600', label: 'Rejected', note: 'This application was not accepted. Please contact the school office for more information.' },
};

export default function ParentRegistrationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campusId } = useCampus();
  const [student, setStudent] = useState(null);

  useEffect(() => {
    api.getParentRegistration(id).then(setStudent).catch(console.error);
  }, [id]);

  if (!student) return <p className="text-gray-500">Loading application…</p>;

  const status = STATUS[student.registrationStatus] || STATUS.PENDING;
  const StatusIcon = status.icon;

  return (
    <div className="max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => navigate(`/campus/${campusId}/my-registrations`)}
        className="flex items-center gap-2 text-gray-500 hover:text-brand-600 mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to my applications
      </button>

      <div className={`card mb-6 flex items-start gap-3 ${status.className} border`}>
        <StatusIcon className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">{status.label}</p>
          <p className="text-sm mt-1 opacity-90">{status.note}</p>
        </div>
      </div>

      <div className="card mb-6">
        <h1 className="text-2xl font-bold">
          {student.lastName} {student.postName} {student.firstName}
        </h1>
        <p className="text-brand-600 font-medium mt-1">{student.studentId}</p>
        <p className="text-sm text-gray-500 mt-2">
          Class requested: {student.class?.name || student.registrationClass || '—'}
          {' · '}
          Submitted {new Date(student.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            title: 'Child details',
            rows: [
              ['Gender', student.gender === 'MALE' ? 'Male' : 'Female'],
              ['Date of birth', student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '—'],
              ['Nationality', student.nationality],
            ],
          },
          {
            title: 'Legal representatives',
            rows: [
              ['Father', student.fatherName],
              ['Father phone', student.fatherPhone],
              ['Mother', student.motherName],
              ['Mother phone', student.motherPhone],
            ],
          },
          {
            title: 'Registration',
            rows: [
              ['Academic year', student.academicYear?.name || student.registrationYear],
              ['Class', student.registrationClass],
              ['Payment', student.paymentMethod],
            ],
          },
        ].map((section) => (
          <div key={section.title} className="card">
            <h3 className="font-semibold text-gray-900 mb-4">{section.title}</h3>
            <dl className="space-y-2">
              {section.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm gap-4">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-gray-900 text-right">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {student.registrationStatus === 'PENDING' && (
        <p className="text-sm text-gray-500 mt-6 text-center">
          Need to make changes? Contact the school office — applications under review cannot be edited online.
        </p>
      )}

      {student.registrationStatus === 'APPROVED' && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to={`/campus/${campusId}/child-accounts`} className="btn-primary">Create student portal account</Link>
          <Link to={`/campus/${campusId}`} className="btn-secondary">Go to family dashboard</Link>
        </div>
      )}
    </div>
  );
}
