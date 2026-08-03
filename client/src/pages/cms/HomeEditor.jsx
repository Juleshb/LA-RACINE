import { useMemo, useState } from 'react';

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
    <Field label={label} hint="Paste an image URL or upload a file (stored in CMS JSON).">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="input flex-1"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
        <label className="btn-secondary text-sm cursor-pointer inline-flex items-center justify-center shrink-0">
          Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const url = await fileToDataUrl(file);
              onChange(url);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {value ? (
        <img src={value} alt="" className="mt-2 h-24 w-auto rounded-lg border border-gray-200 object-cover" />
      ) : null}
    </Field>
  );
}

function PointsEditor({ points, onChange }) {
  const list = Array.isArray(points) ? points : [];
  return (
    <div className="space-y-2">
      {list.map((point, index) => (
        <div key={index} className="flex gap-2">
          <input
            className="input flex-1"
            value={point}
            onChange={(e) => {
              const next = list.map((p, i) => (i === index ? e.target.value : p));
              onChange(next);
            }}
          />
          <button
            type="button"
            className="text-xs text-red-600 hover:underline px-2"
            onClick={() => onChange(list.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary text-sm" onClick={() => onChange([...list, ''])}>
        Add bullet
      </button>
    </div>
  );
}

const EMPTY_SLIDE = {
  eyebrow: '',
  title: '',
  body: '',
  ctaPrimary: '',
  ctaPrimaryTo: '/admissions/apply',
  ctaSecondary: '',
  ctaSecondaryTo: '/locations',
  imageUrl: '',
};

const EMPTY_PROGRAM = {
  tag: '',
  title: '',
  body: '',
  points: [],
  imageUrl: '',
  to: '/academics',
  cta: '',
};

const EMPTY_TESTIMONIAL = { quote: '', name: '', role: '' };
const EMPTY_PAIR = { title: '', body: '' };

/**
 * Dedicated CMS editor for the public landing page (home).
 * Every section rendered by PublicHome / enroll banner is editable here and saved to WebsiteContent.data.
 */
export default function HomeEditor({ data, onChange }) {
  const d = data || {};
  const set = (patch) => onChange({ ...d, ...patch });
  const setNested = (key, value) => onChange({ ...d, [key]: value });

  const [openSlide, setOpenSlide] = useState(0);
  const [openProgram, setOpenProgram] = useState(0);

  const stats = useMemo(() => ({
    campuses: d.stats?.campuses ?? '',
    students: d.stats?.students ?? '',
    languages: d.stats?.languages ?? '',
    focus: d.stats?.focus ?? '',
  }), [d.stats]);

  const slides = Array.isArray(d.heroSlides) ? d.heroSlides : [];
  const programs = Array.isArray(d.programs) ? d.programs : [];
  const whyChoose = Array.isArray(d.whyChoose) ? d.whyChoose : [];
  const values = Array.isArray(d.values) ? d.values : [];
  const testimonials = Array.isArray(d.testimonials) ? d.testimonials : [];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-900">
        Edit the public landing page here. News articles and gallery photos are managed under{' '}
        <strong>News</strong> and <strong>Gallery</strong> — this page only controls the section titles
        and which content appears on Home.
      </div>

      <Section title="1. Hero media" hint="Background video (YouTube) and default poster image when a slide has no image.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Hero video URL">
            <TextInput value={d.heroVideoUrl} onChange={(v) => set({ heroVideoUrl: v })} placeholder="https://youtu.be/…" />
          </Field>
          <ImageField label="Default hero image" value={d.heroImageUrl} onChange={(v) => set({ heroImageUrl: v })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Fallback eyebrow">
            <TextInput value={d.heroEyebrow} onChange={(v) => set({ heroEyebrow: v })} />
          </Field>
          <Field label="Fallback title">
            <TextInput value={d.heroTitle} onChange={(v) => set({ heroTitle: v })} />
          </Field>
          <Field label="Fallback supporting line">
            <TextInput value={d.heroLine} onChange={(v) => set({ heroLine: v })} long />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fallback primary CTA">
              <TextInput value={d.heroCtaPrimary} onChange={(v) => set({ heroCtaPrimary: v })} />
            </Field>
            <Field label="Fallback secondary CTA">
              <TextInput value={d.heroCtaSecondary} onChange={(v) => set({ heroCtaSecondary: v })} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="2. Hero slides" hint="Carousel slides on the landing page. Leave empty to use the fallback hero fields above.">
        {slides.length === 0 && (
          <p className="text-sm text-gray-500">No slides yet. Add at least one for a carousel.</p>
        )}
        <div className="space-y-3">
          {slides.map((slide, index) => (
            <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
                onClick={() => setOpenSlide(openSlide === index ? -1 : index)}
              >
                <span className="text-sm font-medium text-gray-800">
                  Slide {index + 1}{slide.title ? ` — ${slide.title}` : ''}
                </span>
                <span className="text-xs text-gray-500">{openSlide === index ? 'Collapse' : 'Edit'}</span>
              </button>
              {openSlide === index && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setNested('heroSlides', slides.filter((_, i) => i !== index))}
                    >
                      Remove slide
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Eyebrow">
                      <TextInput
                        value={slide.eyebrow}
                        onChange={(v) => {
                          const next = slides.map((s, i) => (i === index ? { ...s, eyebrow: v } : s));
                          setNested('heroSlides', next);
                        }}
                      />
                    </Field>
                    <Field label="Title">
                      <TextInput
                        value={slide.title}
                        onChange={(v) => {
                          const next = slides.map((s, i) => (i === index ? { ...s, title: v } : s));
                          setNested('heroSlides', next);
                        }}
                      />
                    </Field>
                  </div>
                  <Field label="Body">
                    <TextInput
                      long
                      value={slide.body}
                      onChange={(v) => {
                        const next = slides.map((s, i) => (i === index ? { ...s, body: v } : s));
                        setNested('heroSlides', next);
                      }}
                    />
                  </Field>
                  <ImageField
                    label="Slide image"
                    value={slide.imageUrl}
                    onChange={(v) => {
                      const next = slides.map((s, i) => (i === index ? { ...s, imageUrl: v } : s));
                      setNested('heroSlides', next);
                    }}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Primary CTA label">
                      <TextInput
                        value={slide.ctaPrimary}
                        onChange={(v) => {
                          const next = slides.map((s, i) => (i === index ? { ...s, ctaPrimary: v } : s));
                          setNested('heroSlides', next);
                        }}
                      />
                    </Field>
                    <Field label="Primary CTA link" hint="e.g. /admissions/apply">
                      <TextInput
                        value={slide.ctaPrimaryTo}
                        onChange={(v) => {
                          const next = slides.map((s, i) => (i === index ? { ...s, ctaPrimaryTo: v } : s));
                          setNested('heroSlides', next);
                        }}
                      />
                    </Field>
                    <Field label="Secondary CTA label">
                      <TextInput
                        value={slide.ctaSecondary}
                        onChange={(v) => {
                          const next = slides.map((s, i) => (i === index ? { ...s, ctaSecondary: v } : s));
                          setNested('heroSlides', next);
                        }}
                      />
                    </Field>
                    <Field label="Secondary CTA link">
                      <TextInput
                        value={slide.ctaSecondaryTo}
                        onChange={(v) => {
                          const next = slides.map((s, i) => (i === index ? { ...s, ctaSecondaryTo: v } : s));
                          setNested('heroSlides', next);
                        }}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => {
            setNested('heroSlides', [...slides, { ...EMPTY_SLIDE }]);
            setOpenSlide(slides.length);
          }}
        >
          Add slide
        </button>
      </Section>

      <Section title="3. Stats bar" hint="Numbers shown under the hero.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['campuses', 'students', 'languages', 'focus'].map((key) => (
            <Field key={key} label={key}>
              <TextInput
                value={stats[key]}
                onChange={(v) => setNested('stats', { ...stats, [key]: v })}
              />
            </Field>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Campuses label">
            <TextInput value={d.statCampusesLabel} onChange={(v) => set({ statCampusesLabel: v })} />
          </Field>
          <Field label="Students label">
            <TextInput value={d.statStudentsLabel} onChange={(v) => set({ statStudentsLabel: v })} />
          </Field>
          <Field label="Languages label">
            <TextInput value={d.statLanguagesLabel} onChange={(v) => set({ statLanguagesLabel: v })} />
          </Field>
          <Field label="Focus label">
            <TextInput value={d.statFocusLabel} onChange={(v) => set({ statFocusLabel: v })} />
          </Field>
        </div>
      </Section>

      <Section title="4. Programs section" hint="Three program cards on the home page.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Section label">
            <TextInput value={d.programsLabel} onChange={(v) => set({ programsLabel: v })} />
          </Field>
          <Field label="Section title">
            <TextInput value={d.programsTitle} onChange={(v) => set({ programsTitle: v })} />
          </Field>
        </div>
        <Field label="Section lead">
          <TextInput long value={d.programsLead} onChange={(v) => set({ programsLead: v })} />
        </Field>
        <Field label="Default “explore” link text">
          <TextInput value={d.programsExplore} onChange={(v) => set({ programsExplore: v })} />
        </Field>

        <div className="space-y-3 pt-2">
          {programs.map((item, index) => (
            <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
                onClick={() => setOpenProgram(openProgram === index ? -1 : index)}
              >
                <span className="text-sm font-medium text-gray-800">
                  Program {index + 1}{item.title ? ` — ${item.title}` : ''}
                </span>
                <span className="text-xs text-gray-500">{openProgram === index ? 'Collapse' : 'Edit'}</span>
              </button>
              {openProgram === index && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setNested('programs', programs.filter((_, i) => i !== index))}
                    >
                      Remove program
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Tag">
                      <TextInput
                        value={item.tag}
                        onChange={(v) => {
                          const next = programs.map((p, i) => (i === index ? { ...p, tag: v } : p));
                          setNested('programs', next);
                        }}
                      />
                    </Field>
                    <Field label="Title">
                      <TextInput
                        value={item.title}
                        onChange={(v) => {
                          const next = programs.map((p, i) => (i === index ? { ...p, title: v } : p));
                          setNested('programs', next);
                        }}
                      />
                    </Field>
                  </div>
                  <Field label="Body">
                    <TextInput
                      long
                      value={item.body}
                      onChange={(v) => {
                        const next = programs.map((p, i) => (i === index ? { ...p, body: v } : p));
                        setNested('programs', next);
                      }}
                    />
                  </Field>
                  <Field label="Bullet points">
                    <PointsEditor
                      points={item.points}
                      onChange={(points) => {
                        const next = programs.map((p, i) => (i === index ? { ...p, points } : p));
                        setNested('programs', next);
                      }}
                    />
                  </Field>
                  <ImageField
                    label="Image"
                    value={item.imageUrl}
                    onChange={(v) => {
                      const next = programs.map((p, i) => (i === index ? { ...p, imageUrl: v } : p));
                      setNested('programs', next);
                    }}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="CTA label">
                      <TextInput
                        value={item.cta}
                        onChange={(v) => {
                          const next = programs.map((p, i) => (i === index ? { ...p, cta: v } : p));
                          setNested('programs', next);
                        }}
                      />
                    </Field>
                    <Field label="CTA link">
                      <TextInput
                        value={item.to}
                        onChange={(v) => {
                          const next = programs.map((p, i) => (i === index ? { ...p, to: v } : p));
                          setNested('programs', next);
                        }}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => {
            setNested('programs', [...programs, { ...EMPTY_PROGRAM }]);
            setOpenProgram(programs.length);
          }}
        >
          Add program
        </button>
      </Section>

      <Section
        title="5. News section (labels only)"
        hint="Articles themselves are edited under Website → News. These fields control the Home news block headings."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Label">
            <TextInput value={d.newsLabel} onChange={(v) => set({ newsLabel: v })} />
          </Field>
          <Field label="Title">
            <TextInput value={d.newsTitle} onChange={(v) => set({ newsTitle: v })} />
          </Field>
        </div>
        <Field label="Lead">
          <TextInput long value={d.newsLead} onChange={(v) => set({ newsLead: v })} />
        </Field>
        <Field label="“View all” button">
          <TextInput value={d.newsAll} onChange={(v) => set({ newsAll: v })} />
        </Field>
      </Section>

      <Section title="6. Why choose La Racine">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Section label">
            <TextInput value={d.whyLabel} onChange={(v) => set({ whyLabel: v })} />
          </Field>
          <Field label="Section title">
            <TextInput value={d.whyTitle} onChange={(v) => set({ whyTitle: v })} />
          </Field>
        </div>
        <Field label="Lead">
          <TextInput long value={d.whyLead} onChange={(v) => set({ whyLead: v })} />
        </Field>
        <Field label="Photo caption">
          <TextInput value={d.whyCaption} onChange={(v) => set({ whyCaption: v })} />
        </Field>
        <ImageField label="Side image" value={d.whoImageUrl} onChange={(v) => set({ whoImageUrl: v })} />
        <Field label="Side image alt text">
          <TextInput value={d.whoImageAlt} onChange={(v) => set({ whoImageAlt: v })} />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Primary CTA (Our story)">
            <TextInput value={d.whoCtaStory} onChange={(v) => set({ whoCtaStory: v })} />
          </Field>
          <Field label="Secondary CTA (Academics)">
            <TextInput value={d.whoCtaAcademics} onChange={(v) => set({ whoCtaAcademics: v })} />
          </Field>
        </div>

        <div className="pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Reason cards</p>
          <div className="space-y-3">
            {whyChoose.map((item, index) => (
              <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-gray-700">Card {index + 1}</p>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => setNested('whyChoose', whyChoose.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
                <Field label="Title">
                  <TextInput
                    value={item.title}
                    onChange={(v) => {
                      const next = whyChoose.map((it, i) => (i === index ? { ...it, title: v } : it));
                      setNested('whyChoose', next);
                    }}
                  />
                </Field>
                <Field label="Body">
                  <TextInput
                    long
                    value={item.body}
                    onChange={(v) => {
                      const next = whyChoose.map((it, i) => (i === index ? { ...it, body: v } : it));
                      setNested('whyChoose', next);
                    }}
                  />
                </Field>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-secondary text-sm mt-3"
            onClick={() => setNested('whyChoose', [...whyChoose, { ...EMPTY_PAIR }])}
          >
            Add reason card
          </button>
        </div>
      </Section>

      <Section
        title="7. Gallery section (labels only)"
        hint="Images are managed under Website → Gallery."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Label">
            <TextInput value={d.galleryLabel} onChange={(v) => set({ galleryLabel: v })} />
          </Field>
          <Field label="Title">
            <TextInput value={d.galleryTitle} onChange={(v) => set({ galleryTitle: v })} />
          </Field>
        </div>
        <Field label="Lead">
          <TextInput long value={d.galleryLead} onChange={(v) => set({ galleryLead: v })} />
        </Field>
        <Field label="“Open gallery” button">
          <TextInput value={d.galleryAll} onChange={(v) => set({ galleryAll: v })} />
        </Field>
      </Section>

      <Section title="8. Testimonials / voices">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Label">
            <TextInput value={d.voicesLabel} onChange={(v) => set({ voicesLabel: v })} />
          </Field>
          <Field label="Title">
            <TextInput value={d.voicesTitle} onChange={(v) => set({ voicesTitle: v })} />
          </Field>
        </div>
        <Field label="Lead">
          <TextInput long value={d.voicesLead} onChange={(v) => set({ voicesLead: v })} />
        </Field>
        <div className="space-y-3 pt-1">
          {testimonials.map((item, index) => (
            <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2">
              <div className="flex justify-between">
                <p className="text-sm font-medium text-gray-700">Quote {index + 1}</p>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => setNested('testimonials', testimonials.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
              <Field label="Quote">
                <TextInput
                  long
                  value={item.quote}
                  onChange={(v) => {
                    const next = testimonials.map((it, i) => (i === index ? { ...it, quote: v } : it));
                    setNested('testimonials', next);
                  }}
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Name">
                  <TextInput
                    value={item.name}
                    onChange={(v) => {
                      const next = testimonials.map((it, i) => (i === index ? { ...it, name: v } : it));
                      setNested('testimonials', next);
                    }}
                  />
                </Field>
                <Field label="Role">
                  <TextInput
                    value={item.role}
                    onChange={(v) => {
                      const next = testimonials.map((it, i) => (i === index ? { ...it, role: v } : it));
                      setNested('testimonials', next);
                    }}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => setNested('testimonials', [...testimonials, { ...EMPTY_TESTIMONIAL }])}
        >
          Add testimonial
        </button>
      </Section>

      <Section title="9. Bottom CTA band">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Label">
            <TextInput value={d.nextLabel} onChange={(v) => set({ nextLabel: v })} />
          </Field>
          <Field label="Title">
            <TextInput value={d.nextTitle} onChange={(v) => set({ nextTitle: v })} />
          </Field>
        </div>
        <Field label="Lead">
          <TextInput long value={d.nextLead} onChange={(v) => set({ nextLead: v })} />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Apply CTA">
            <TextInput value={d.nextCtaAdmissions} onChange={(v) => set({ nextCtaAdmissions: v })} />
          </Field>
          <Field label="Contact CTA">
            <TextInput value={d.nextCtaContact} onChange={(v) => set({ nextCtaContact: v })} />
          </Field>
          <Field label="Portal CTA">
            <TextInput value={d.nextCtaPortal} onChange={(v) => set({ nextCtaPortal: v })} />
          </Field>
        </div>
      </Section>

      <Section title="10. Floating enroll banner" hint="Shown on every public page until dismissed.">
        <Field label="Title">
          <TextInput value={d.enrollTitle} onChange={(v) => set({ enrollTitle: v })} />
        </Field>
        <Field label="Body">
          <TextInput long value={d.enrollBody} onChange={(v) => set({ enrollBody: v })} />
        </Field>
        <Field label="Button label">
          <TextInput value={d.enrollCta} onChange={(v) => set({ enrollCta: v })} />
        </Field>
      </Section>

      <Section title="11. Legacy promise values" hint="Optional fallback if “Why choose” cards are empty. Also used by older page layouts.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Promise label">
            <TextInput value={d.promiseLabel} onChange={(v) => set({ promiseLabel: v })} />
          </Field>
          <Field label="Promise title">
            <TextInput value={d.promiseTitle} onChange={(v) => set({ promiseTitle: v })} />
          </Field>
        </div>
        <Field label="Promise lead">
          <TextInput long value={d.promiseLead} onChange={(v) => set({ promiseLead: v })} />
        </Field>
        <div className="space-y-3">
          {values.map((item, index) => (
            <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2">
              <div className="flex justify-between">
                <p className="text-sm font-medium text-gray-700">Value {index + 1}</p>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => setNested('values', values.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
              <Field label="Title">
                <TextInput
                  value={item.title}
                  onChange={(v) => {
                    const next = values.map((it, i) => (i === index ? { ...it, title: v } : it));
                    setNested('values', next);
                  }}
                />
              </Field>
              <Field label="Body">
                <TextInput
                  long
                  value={item.body}
                  onChange={(v) => {
                    const next = values.map((it, i) => (i === index ? { ...it, body: v } : it));
                    setNested('values', next);
                  }}
                />
              </Field>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => setNested('values', [...values, { ...EMPTY_PAIR }])}
        >
          Add value
        </button>
      </Section>
    </div>
  );
}
