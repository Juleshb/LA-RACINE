import { useEffect, useState } from 'react';
import { Save, School, Mail, CreditCard, Shield } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

export default function SchoolProfile() {
  const { t } = useTranslation();
  const { isManager } = useAuth();
  const [school, setSchool] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [otpEnabled, setOtpEnabled] = useState(true);
  const [otpSaving, setOtpSaving] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const successMessage = t('staffDash.schoolProfile.saveSuccess');

  useEffect(() => {
    api.getSchool().then((data) => {
      setSchool(data);
      setForm(data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isManager) return;
    api.getSecuritySettings()
      .then((data) => setOtpEnabled(Boolean(data.otpEnabled)))
      .catch(console.error);
  }, [isManager]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBankChange = (index, field, value) => {
    const accounts = [...(form.bankAccounts || [])];
    accounts[index] = { ...accounts[index], [field]: value };
    setForm((prev) => ({ ...prev, bankAccounts: accounts }));
  };

  const addBankAccount = () => {
    setForm((prev) => ({
      ...prev,
      bankAccounts: [...(prev.bankAccounts || []), { bankName: '', accountNumber: '' }],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const updated = await api.updateSchool(school.id, form);
      setSchool(updated);
      setForm(updated);
      setMessage(successMessage);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOtpToggle = async (nextEnabled) => {
    setOtpSaving(true);
    setOtpMessage('');
    try {
      const data = await api.updateSecuritySettings({ otpEnabled: nextEnabled });
      setOtpEnabled(Boolean(data.otpEnabled));
      setOtpMessage(
        data.otpEnabled
          ? 'OTP enabled — required for login and student deletion.'
          : 'OTP stopped — login and student deletion no longer require a code.',
      );
    } catch (err) {
      setOtpMessage(err.message);
    } finally {
      setOtpSaving(false);
    }
  };

  if (!school) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isSuccess = message === successMessage;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{t('pages.school.title')}</h1>
          <p className="text-gray-400 mt-1">{t('pages.school.description')}</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? t('ui.saving') : t('ui.saveChanges')}
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${isSuccess ? 'bg-brand-50 text-brand-600' : 'bg-red-600/20 text-red-400'}`}>
          {message}
        </div>
      )}

      {isManager && (
        <div className="card mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-brand-600 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold">Email OTP security</h2>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  When enabled, users must enter an email OTP to sign in and to delete a student.
                  When stopped, password login and student deletion work without OTP.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${otpEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>
                {otpEnabled ? 'OTP required' : 'OTP stopped'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={otpEnabled}
                disabled={otpSaving}
                onClick={() => handleOtpToggle(!otpEnabled)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
                  otpEnabled ? 'bg-brand-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                    otpEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
          {otpMessage && (
            <p className={`mt-3 text-sm ${otpMessage.includes('failed') || otpMessage.includes('error') || otpMessage.includes('denied') ? 'text-red-600' : 'text-gray-600'}`}>
              {otpSaving ? 'Saving…' : otpMessage}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <School className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-semibold">{t('staffDash.schoolProfile.schoolDetails')}</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">{t('staffDash.schoolProfile.schoolName')}</label>
              <input className="input" value={form.name || ''} onChange={(e) => handleChange('name', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('staffDash.schoolProfile.abbreviation')}</label>
              <input className="input" value={form.abbreviation || ''} onChange={(e) => handleChange('abbreviation', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('staffDash.schoolProfile.country')}</label>
                <input className="input" value={form.country || ''} onChange={(e) => handleChange('country', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('staffDash.schoolProfile.province')}</label>
                <input className="input" value={form.province || ''} onChange={(e) => handleChange('province', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('staffDash.schoolProfile.district')}</label>
                <input className="input" value={form.district || ''} onChange={(e) => handleChange('district', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('staffDash.schoolProfile.city')}</label>
                <input className="input" value={form.city || ''} onChange={(e) => handleChange('city', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">{t('staffDash.schoolProfile.tin')}</label>
              <input className="input" value={form.tin || ''} onChange={(e) => handleChange('tin', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-6">
              <Mail className="w-5 h-5 text-brand-600" />
              <h2 className="text-lg font-semibold">{t('staffDash.schoolProfile.contactInformation')}</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">{t('ui.email')}</label>
                <input className="input" type="email" value={form.email || ''} onChange={(e) => handleChange('email', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('staffDash.schoolProfile.phone1')}</label>
                  <input className="input" value={form.phone1 || ''} onChange={(e) => handleChange('phone1', e.target.value)} />
                </div>
                <div>
                  <label className="label">{t('staffDash.schoolProfile.phone2')}</label>
                  <input className="input" value={form.phone2 || ''} onChange={(e) => handleChange('phone2', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">{t('staffDash.schoolProfile.website')}</label>
                <input className="input" value={form.website || ''} onChange={(e) => handleChange('website', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-600" />
                <h2 className="text-lg font-semibold">{t('staffDash.schoolProfile.feePaymentAccounts')}</h2>
              </div>
              <button onClick={addBankAccount} className="text-sm text-brand-600 hover:text-brand-600">
                {t('staffDash.schoolProfile.addAccount')}
              </button>
            </div>
            <div className="space-y-4">
              {(form.bankAccounts || []).map((acc, index) => (
                <div key={index} className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('staffDash.schoolProfile.bankName')}</label>
                    <input
                      className="input"
                      value={acc.bankName || ''}
                      onChange={(e) => handleBankChange(index, 'bankName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">{t('staffDash.schoolProfile.accountNumber')}</label>
                    <input
                      className="input"
                      value={acc.accountNumber || ''}
                      onChange={(e) => handleBankChange(index, 'accountNumber', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
