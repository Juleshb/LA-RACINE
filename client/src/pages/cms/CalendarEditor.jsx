import { useState } from 'react';
import { api } from '../../lib/api';
import { getApiOrigin } from '../../lib/config';

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resolveFileUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const origin = getApiOrigin();
  if (url.startsWith('/')) return `${origin}${url}`;
  return url;
}

function Section({ title, hint, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, long = false, placeholder = '' }) {
  if (long) {
    return (
      <textarea
        className="input min-h-[88px]"
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      className="input"
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const EMPTY_LEVEL = {
  id: '',
  label: '',
  subtitle: '',
  sectionTitle: '',
  sectionLead: '',
  calendars: [],
};

const EMPTY_CALENDAR = {
  campusName: '',
  city: '',
  fileName: '',
  fileUrl: '',
};

/**
 * CMS editor for School Calendar page — levels + campus PDF uploads.
 */
export default function CalendarEditor({ data, onChange }) {
  const d = data || {};
  const set = (patch) => onChange({ ...d, ...patch });
  const levels = Array.isArray(d.levels) ? d.levels : [];
  const [open, setOpen] = useState(0);
  const [uploading, setUploading] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const updateLevel = (index, patch) => {
    set({ levels: levels.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
  };

  const updateCalendar = (levelIndex, calIndex, patch) => {
    const level = levels[levelIndex] || {};
    const calendars = Array.isArray(level.calendars) ? level.calendars : [];
    updateLevel(levelIndex, {
      calendars: calendars.map((c, i) => (i === calIndex ? { ...c, ...patch } : c)),
    });
  };

  const uploadPdf = async (levelIndex, calIndex, file) => {
    if (!file) return;
    const key = `${levelIndex}-${calIndex}`;
    setUploading(key);
    setUploadError('');
    try {
      const contentBase64 = await fileToDataUrl(file);
      const saved = await api.uploadCalendarPdf(file.name, contentBase64);
      updateCalendar(levelIndex, calIndex, {
        fileName: saved.fileName || file.name,
        fileUrl: saved.fileUrl,
      });
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-900">
        Publish academic calendars by program level. Families open the public page at{' '}
        <code className="text-xs bg-white/80 px-1 rounded">/calendar</code>
        {' '}and download campus PDFs. Upload PDFs here (max 12 MB) — they are stored on the server, not in CMS JSON.
      </div>

      <Section title="Page intro">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Label"><TextInput value={d.label} onChange={(v) => set({ label: v })} /></Field>
          <Field label="Academic year line"><TextInput value={d.academicYearLabel} onChange={(v) => set({ academicYearLabel: v })} placeholder="Academic Year 2026 — 27" /></Field>
        </div>
        <Field label="Title"><TextInput value={d.title} onChange={(v) => set({ title: v })} /></Field>
        <Field label="Lead"><TextInput long value={d.lead} onChange={(v) => set({ lead: v })} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="View PDF button"><TextInput value={d.viewPdf} onChange={(v) => set({ viewPdf: v })} /></Field>
          <Field label="Empty level message"><TextInput value={d.emptyLevel} onChange={(v) => set({ emptyLevel: v })} /></Field>
        </div>
        <Field label="Footer note"><TextInput long value={d.note} onChange={(v) => set({ note: v })} /></Field>
      </Section>

      <Section title="Help band">
        <Field label="Title"><TextInput value={d.helpTitle} onChange={(v) => set({ helpTitle: v })} /></Field>
        <Field label="Lead"><TextInput long value={d.helpLead} onChange={(v) => set({ helpLead: v })} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Contact CTA"><TextInput value={d.ctaContact} onChange={(v) => set({ ctaContact: v })} /></Field>
          <Field label="Apply CTA"><TextInput value={d.ctaApply} onChange={(v) => set({ ctaApply: v })} /></Field>
        </div>
      </Section>

      <Section title="Program levels" hint="Each level appears as a tab on the public calendar page (Nursery, Primary, …).">
        {uploadError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{uploadError}</div>
        )}

        {levels.map((level, levelIndex) => {
          const calendars = Array.isArray(level.calendars) ? level.calendars : [];
          return (
            <div key={levelIndex} className="rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
                onClick={() => setOpen(open === levelIndex ? -1 : levelIndex)}
              >
                <span className="text-sm font-medium text-gray-800">
                  {level.label || `Level ${levelIndex + 1}`}
                  {level.id ? ` · ${level.id}` : ''}
                </span>
                <span className="text-xs text-gray-500">{open === levelIndex ? 'Collapse' : 'Edit'}</span>
              </button>

              {open === levelIndex && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => set({ levels: levels.filter((_, i) => i !== levelIndex) })}
                    >
                      Remove level
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="ID (slug)" hint="e.g. nursery, primary">
                      <TextInput value={level.id} onChange={(v) => updateLevel(levelIndex, { id: v })} />
                    </Field>
                    <Field label="Tab label">
                      <TextInput value={level.label} onChange={(v) => updateLevel(levelIndex, { label: v })} />
                    </Field>
                    <Field label="Tab subtitle">
                      <TextInput value={level.subtitle} onChange={(v) => updateLevel(levelIndex, { subtitle: v })} />
                    </Field>
                    <Field label="Section title">
                      <TextInput value={level.sectionTitle} onChange={(v) => updateLevel(levelIndex, { sectionTitle: v })} />
                    </Field>
                  </div>
                  <Field label="Section lead">
                    <TextInput long value={level.sectionLead} onChange={(v) => updateLevel(levelIndex, { sectionLead: v })} />
                  </Field>

                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Campus calendars</p>
                    {calendars.map((cal, calIndex) => {
                      const key = `${levelIndex}-${calIndex}`;
                      const busy = uploading === key;
                      return (
                        <div key={calIndex} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Field label="Campus name">
                              <TextInput
                                value={cal.campusName}
                                onChange={(v) => updateCalendar(levelIndex, calIndex, { campusName: v })}
                              />
                            </Field>
                            <Field label="City / area">
                              <TextInput
                                value={cal.city}
                                onChange={(v) => updateCalendar(levelIndex, calIndex, { city: v })}
                              />
                            </Field>
                          </div>
                          <Field label="PDF" hint="Upload a PDF or paste a public URL.">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                className="input flex-1"
                                value={cal.fileUrl || ''}
                                placeholder="/uploads/calendar/… or https://…"
                                onChange={(e) => updateCalendar(levelIndex, calIndex, { fileUrl: e.target.value })}
                              />
                              <label className="btn-secondary text-sm cursor-pointer inline-flex items-center justify-center shrink-0">
                                {busy ? 'Uploading…' : 'Upload PDF'}
                                <input
                                  type="file"
                                  accept="application/pdf,.pdf"
                                  className="hidden"
                                  disabled={busy}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    if (file) await uploadPdf(levelIndex, calIndex, file);
                                  }}
                                />
                              </label>
                            </div>
                            {cal.fileUrl ? (
                              <a
                                href={resolveFileUrl(cal.fileUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-block text-sm text-brand-700 hover:underline"
                              >
                                Open current PDF{cal.fileName ? ` (${cal.fileName})` : ''}
                              </a>
                            ) : (
                              <p className="mt-1 text-xs text-amber-700">No PDF yet — this campus card stays hidden on the public page until a file is set.</p>
                            )}
                          </Field>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:underline"
                              onClick={() =>
                                updateLevel(levelIndex, {
                                  calendars: calendars.filter((_, i) => i !== calIndex),
                                })
                              }
                            >
                              Remove campus
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() =>
                        updateLevel(levelIndex, { calendars: [...calendars, { ...EMPTY_CALENDAR }] })
                      }
                    >
                      Add campus calendar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => set({ levels: [...levels, { ...EMPTY_LEVEL, calendars: [{ ...EMPTY_CALENDAR }] }] })}
        >
          Add program level
        </button>
      </Section>
    </div>
  );
}
