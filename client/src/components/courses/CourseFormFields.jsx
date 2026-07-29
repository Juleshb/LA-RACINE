import FormSection from '../form/FormSection';

export default function CourseFormFields({
  form,
  setForm,
  isEditing,
  curriculumDomains,
  domainOptions,
  selectedDomain,
  teachers,
  onPickTemplate,
  exMax,
}) {
  return (
    <>
      <FormSection
        title="Domain / Domaine"
        description={isEditing ? 'Move this sub-subject to another domain if needed' : 'Where this sub-subject belongs on the bulletin'}
      >
        {!isEditing && form.entryMode === 'template' ? (
          <>
            <div>
              <label className="label">Domain *</label>
              <select
                className="input"
                required
                value={form.domainIndex}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    domainIndex: e.target.value,
                    subjectIndex: '',
                    name: '',
                    code: '',
                    test1Max: '',
                    test2Max: '',
                  }));
                }}
              >
                <option value="">— Select domain —</option>
                {curriculumDomains.map((d, i) => (
                  <option key={d.name} value={i}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Sub-subject from template *</label>
              <select
                className="input"
                required
                value={form.subjectIndex}
                disabled={form.domainIndex === ''}
                onChange={(e) => onPickTemplate(form.domainIndex, e.target.value)}
              >
                <option value="">— Select sub-subject —</option>
                {selectedDomain?.subjects?.map((s, i) => (
                  <option key={s.code} value={i}>{s.name} (T1/{s.test1Max} · T2/{s.test2Max})</option>
                ))}
              </select>
              {form.subjectIndex !== '' && (
                <p className="field-hint-accent">Fields below are filled from the template — you can adjust them.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="label">Domain *</label>
              <select
                className="input"
                required
                value={form.domainChoice}
                onChange={(e) => setForm((f) => ({ ...f, domainChoice: e.target.value, customDomain: '' }))}
              >
                <option value="">— Select domain —</option>
                {domainOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
                <option value="__new__">+ Add new domain…</option>
              </select>
            </div>
            {form.domainChoice === '__new__' && (
              <div>
                <label className="label">New domain name *</label>
                <input
                  className="input"
                  required
                  placeholder="e.g. MATHEMATIQUES"
                  value={form.customDomain}
                  onChange={(e) => setForm({ ...form, customDomain: e.target.value })}
                />
              </div>
            )}
          </>
        )}
      </FormSection>

      <FormSection
        title="Sub-subject details"
        description="Name, code, and grading maxima for this class"
      >
        <div>
          <label className="label">Name *</label>
          <input
            className="input"
            required
            placeholder="e.g. Numération"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Code *</label>
          <input
            className="input"
            required
            placeholder="e.g. MATH-NUM"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
        </div>
        <div>
          <label className="label">TEST1 max</label>
          <input
            className="input"
            type="number"
            min="1"
            placeholder="10"
            value={form.test1Max}
            onChange={(e) => setForm({ ...form, test1Max: e.target.value })}
          />
        </div>
        <div>
          <label className="label">TEST2 max</label>
          <input
            className="input"
            type="number"
            min="1"
            placeholder="10"
            value={form.test2Max}
            onChange={(e) => setForm({ ...form, test2Max: e.target.value })}
          />
          {exMax != null && (
            <p className="field-hint-accent">
              EX: {exMax} pts · Total: {exMax * 2} pts
            </p>
          )}
        </div>
        <div>
          <label className="label">Teacher</label>
          <select className="input" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
            <option value="">Not assigned</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Periods / week</label>
          <input
            className="input"
            type="number"
            min="1"
            max="20"
            value={form.periodsPerWeek}
            onChange={(e) => setForm({ ...form, periodsPerWeek: e.target.value })}
          />
        </div>
      </FormSection>
    </>
  );
}
