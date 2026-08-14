import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', maximumFractionDigits: 0 }).format(amount);
}

const feeTypeLabels = {
  TUITION: 'Tuition Fee',
  REGISTRATION: 'Registration Fee',
  EXAM: 'Exam Fee',
  TRANSPORT: 'Transport Fee',
  UNIFORM: 'Uniform Fee',
  OTHER: 'Other Fee',
  CONFIRMATION: 'Confirmation fee',
};

export default function FeeReceipt() {
  const { id } = useParams();
  const { campusId } = useCampus();
  const [fee, setFee] = useState(null);
  const [school, setSchool] = useState(null);

  useEffect(() => {
    Promise.all([api.getFee(id), api.getSchool()])
      .then(([f, s]) => { setFee(f); setSchool(s); })
      .catch(console.error);
  }, [id]);

  if (!fee || !school) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <Link to={`/campus/${campusId}/fees`} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{fee.receiptNumber}</h1>
            <p className="text-gray-400 mt-1">Fee receipt</p>
          </div>
        </div>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2">
          <Printer className="w-4 h-4" />
          Print Receipt
        </button>
      </div>

      <div className="card max-w-3xl mx-auto print:bg-white print:text-black print:border-0">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-brand-600 print:text-green-700">{school.name}</h2>
          <p className="text-sm text-gray-400 print:text-gray-600">{school.city}, {school.district}, {school.country}</p>
          <p className="text-sm text-gray-400 print:text-gray-600">Tel: {school.phone1} | Email: {school.email}</p>
        </div>

        <div className="text-center mb-8">
          <h3 className="text-lg font-bold uppercase tracking-wide">Fee Receipt</h3>
          <p className="text-brand-600 print:text-green-700 font-medium mt-1">{fee.receiptNumber}</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
          <div>
            <p className="text-gray-400 print:text-gray-600 mb-1">Student:</p>
            <p className="font-semibold">{fee.student.firstName} {fee.student.lastName}</p>
            <p className="text-gray-400 print:text-gray-600">{fee.student.studentId}</p>
            {fee.student.class && <p className="text-gray-400 print:text-gray-600">Class: {fee.student.class.name}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm"><span className="text-gray-400 print:text-gray-600">Date: </span>{new Date(fee.createdAt).toLocaleDateString()}</p>
            <p className="text-sm"><span className="text-gray-400 print:text-gray-600">Due Date: </span>{new Date(fee.dueDate).toLocaleDateString()}</p>
            {fee.paidDate && (
              <p className="text-sm"><span className="text-gray-400 print:text-gray-600">Paid Date: </span>{new Date(fee.paidDate).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        <div className="bg-gray-50 print:bg-gray-100 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 print:text-gray-600 text-sm">Fee Type</p>
              <p className="font-semibold text-lg">{feeTypeLabels[fee.feeType]}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 print:text-gray-600 text-sm">Amount</p>
              <p className="font-bold text-2xl text-brand-600 print:text-green-700">{formatCurrency(fee.amount)}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 print:border-gray-300">
            <p className="text-sm">
              Status: <span className="font-medium">{fee.status}</span>
            </p>
          </div>
        </div>

        {fee.notes && (
          <div className="mb-8">
            <p className="text-sm text-gray-400 print:text-gray-600 mb-1">Notes:</p>
            <p className="text-sm">{fee.notes}</p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 print:border-gray-300 text-sm text-brand-600 print:text-green-700">
          <p className="font-semibold">Payment Accounts:</p>
          {school.bankAccounts.map((acc) => (
            <p key={acc.id}>{acc.bankName}: {acc.accountNumber}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
