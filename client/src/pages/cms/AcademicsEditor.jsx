import { useState } from 'react';

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

function ImageField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="input flex-1" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
        <label className="btn-secondary text-sm cursor-pointer inline-flex items-center justify-center shrink-0">
          Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onChange(await fileToDataUrl(file));
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {value ? <img src={value} alt="" className="mt-2 h-24 w-auto rounded-lg border object-cover" /> : null}
    </Field>
  );
}

function StringList({ items, onChange, addLabel = 'Add item' }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="space-y-2">
      {list.map((item, index) => (
        <div key={index} className="flex gap-2">
          <input
            className="input flex-1"
            value={item}
            onChange={(e) => onChange(list.map((v, i) => (i === index ? e.target.value : v)))}
          />
          <button type="button" className="text-xs text-red-600 hover:underline px-2" onClick={() => onChange(list.filter((_, i) => i !== index))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary text-sm" onClick={() => onChange([...list, ''])}>
        {addLabel}
      </button>
    </div>
  );
}

const EMPTY_PROGRAM = {
  slug: '',
  tag: '',
  title: '',
  body: '',
  imageUrl: '',
  heroEyebrow: '',
  detailTitle: '',
  detailLead: '',
  approachTitle: '',
  approachBody: '',
  approachHighlights: [],
  approachImageUrl: '',
  offeringsTitle: '',
  offeringsLead: '',
  offerings: [],
  readyTitle: '',
  readyLead: '',
  ctaEnroll: 'Apply now',
  ctaVisit: 'Schedule a visit',
  features: [],
};

const EMPTY_OFFERING = { tag: '', title: '', body: '', points: [], cta: '', to: '/admissions/apply' };

/**
 * CMS editor for Academics page + detailed program pages (/academics/:slug).
 */
export default function AcademicsEditor({ data, onChange }) {
  const d = data || {};
  const set = (patch) => onChange({ ...d, ...patch });
  const programs = Array.isArray(d.programs) ? d.programs : [];
  const [open, setOpen] = useState(0);

  const updateProgram = (index, patch) => {
    const next = programs.map((p, i) => (i === index ? { ...p, ...patch } : p));
    set({ programs: next });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-900">
        Edit the Academics overview and each program’s detail page. Public URLs are{' '}
        <code className="text-xs bg-white/80 px-1 rounded">/academics/{'{slug}'}</code>
        {' '}(example: <code className="text-xs bg-white/80 px-1 rounded">/academics/nursery</code>).
      </div>

      <Section title="Academics overview">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Label"><TextInput value={d.label} onChange={(v) => set({ label: v })} /></Field>
          <Field label="Title"><TextInput value={d.title} onChange={(v) => set({ title: v })} /></Field>
        </div>
        <Field label="Lead"><TextInput long value={d.lead} onChange={(v) => set({ lead: v })} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Placement CTA"><TextInput value={d.ctaPlacement} onChange={(v) => set({ ctaPlacement: v })} /></Field>
          <Field label="Portal CTA"><TextInput value={d.ctaPortal} onChange={(v) => set({ ctaPortal: v })} /></Field>
          <Field label="Back to programs label"><TextInput value={d.backToPrograms} onChange={(v) => set({ backToPrograms: v })} /></Field>
        </div>
      </Section>

      <Section title="Programs" hint="Each program has a listing card and a full detail page.">
        {programs.map((program, index) => (
          <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
              onClick={() => setOpen(open === index ? -1 : index)}
            >
              <span className="text-sm font-medium text-gray-800">
                {program.title || `Program ${index + 1}`}
                {program.slug ? ` · /academics/${program.slug}` : ''}
              </span>
              <span className="text-xs text-gray-500">{open === index ? 'Collapse' : 'Edit'}</span>
            </button>
            {open === index && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => set({ programs: programs.filter((_, i) => i !== index) })}
                  >
                    Remove program
                  </button>
                </div>

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Card & URL</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Slug (URL)" hint="nursery, primary, beyond…">
                    <TextInput value={program.slug} onChange={(v) => updateProgram(index, { slug: v.trim().toLowerCase() })} />
                  </Field>
                  <Field label="Tag"><TextInput value={program.tag} onChange={(v) => updateProgram(index, { tag: v })} /></Field>
                  <Field label="Title"><TextInput value={program.title} onChange={(v) => updateProgram(index, { title: v })} /></Field>
                </div>
                <Field label="Short description (listing)"><TextInput long value={program.body} onChange={(v) => updateProgram(index, { body: v })} /></Field>
                <ImageField label="Card / hero image" value={program.imageUrl} onChange={(v) => updateProgram(index, { imageUrl: v })} />

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-2">Detail page</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Hero eyebrow"><TextInput value={program.heroEyebrow} onChange={(v) => updateProgram(index, { heroEyebrow: v })} /></Field>
                  <Field label="Detail title"><TextInput value={program.detailTitle} onChange={(v) => updateProgram(index, { detailTitle: v })} /></Field>
                </div>
                <Field label="Detail lead"><TextInput long value={program.detailLead} onChange={(v) => updateProgram(index, { detailLead: v })} /></Field>
                <Field label="Approach title"><TextInput value={program.approachTitle} onChange={(v) => updateProgram(index, { approachTitle: v })} /></Field>
                <Field label="Approach body"><TextInput long value={program.approachBody} onChange={(v) => updateProgram(index, { approachBody: v })} /></Field>
                <Field label="Approach highlights">
                  <StringList
                    items={program.approachHighlights}
                    onChange={(approachHighlights) => updateProgram(index, { approachHighlights })}
                    addLabel="Add highlight"
                  />
                </Field>
                <ImageField label="Approach image" value={program.approachImageUrl} onChange={(v) => updateProgram(index, { approachImageUrl: v })} />

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-2">Offerings</p>
                <Field label="Offerings title"><TextInput value={program.offeringsTitle} onChange={(v) => updateProgram(index, { offeringsTitle: v })} /></Field>
                <Field label="Offerings lead"><TextInput long value={program.offeringsLead} onChange={(v) => updateProgram(index, { offeringsLead: v })} /></Field>
                <div className="space-y-3">
                  {(program.offerings || []).map((off, oi) => (
                    <div key={oi} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                      <div className="flex justify-between">
                        <p className="text-sm font-medium">Offering {oi + 1}</p>
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => {
                            const offerings = (program.offerings || []).filter((_, i) => i !== oi);
                            updateProgram(index, { offerings });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Field label="Tag">
                          <TextInput
                            value={off.tag}
                            onChange={(v) => {
                              const offerings = (program.offerings || []).map((o, i) => (i === oi ? { ...o, tag: v } : o));
                              updateProgram(index, { offerings });
                            }}
                          />
                        </Field>
                        <Field label="Title">
                          <TextInput
                            value={off.title}
                            onChange={(v) => {
                              const offerings = (program.offerings || []).map((o, i) => (i === oi ? { ...o, title: v } : o));
                              updateProgram(index, { offerings });
                            }}
                          />
                        </Field>
                      </div>
                      <Field label="Body">
                        <TextInput
                          long
                          value={off.body}
                          onChange={(v) => {
                            const offerings = (program.offerings || []).map((o, i) => (i === oi ? { ...o, body: v } : o));
                            updateProgram(index, { offerings });
                          }}
                        />
                      </Field>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => updateProgram(index, { offerings: [...(program.offerings || []), { ...EMPTY_OFFERING }] })}
                >
                  Add offering
                </button>

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-2">Closing CTA</p>
                <Field label="Ready title"><TextInput value={program.readyTitle} onChange={(v) => updateProgram(index, { readyTitle: v })} /></Field>
                <Field label="Ready lead"><TextInput long value={program.readyLead} onChange={(v) => updateProgram(index, { readyLead: v })} /></Field>
                <Field label="Feature chips">
                  <StringList items={program.features} onChange={(features) => updateProgram(index, { features })} addLabel="Add feature" />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Enroll CTA"><TextInput value={program.ctaEnroll} onChange={(v) => updateProgram(index, { ctaEnroll: v })} /></Field>
                  <Field label="Visit CTA"><TextInput value={program.ctaVisit} onChange={(v) => updateProgram(index, { ctaVisit: v })} /></Field>
                </div>
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => {
            set({ programs: [...programs, { ...EMPTY_PROGRAM }] });
            setOpen(programs.length);
          }}
        >
          Add program
        </button>
      </Section>
    </div>
  );
}
