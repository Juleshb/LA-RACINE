import { Plus, Trash2, Save } from 'lucide-react';

function emptyTest(index) {
  return {
    label: `Test ${index}`,
    maxScore: '',
    date: '',
    sortOrder: index,
  };
}

export default function SubjectTestManager({
  tests,
  testsMarkMax,
  examMax,
  totalMax,
  onChange,
  onSave,
  saving,
  canEdit,
}) {
  const updateTest = (index, field, value) => {
    const next = tests.map((t, i) => (i === index ? { ...t, [field]: value } : t));
    onChange(next, testsMarkMax, examMax);
  };

  const addTest = () => {
    const next = [...tests, emptyTest(tests.length + 1)];
    onChange(next, testsMarkMax, examMax);
  };

  const removeTest = (index) => {
    if (tests.length <= 1) return;
    const next = tests
      .filter((_, i) => i !== index)
      .map((t, i) => ({ ...t, sortOrder: i + 1, label: t.label || `Test ${i + 1}` }));
    onChange(next, testsMarkMax, examMax);
  };

  const rawTestMax = tests.reduce((sum, t) => sum + (Number(t.maxScore) || 0), 0);
  const computedTotal = (Number(testsMarkMax) || 0) + (Number(examMax) || 0);

  return (
    <div className="card mb-6 border-brand-100">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Tests & exam setup</h3>
          <p className="text-sm text-gray-500 mt-1">
            Record each test separately, then record the exam. On the bulletin, tests are combined into one TEST column, with EX and TOT.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={addTest} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Add test
          </button>
        )}
      </div>

      <div className="space-y-3">
        {tests.map((test, index) => (
          <div key={`${test.id || 'new'}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_120px_170px_auto] gap-3 items-end">
            <div>
              <label className="label">Test name</label>
              <input
                className="input"
                value={test.label}
                disabled={!canEdit}
                onChange={(e) => updateTest(index, 'label', e.target.value)}
                placeholder={`Test ${index + 1}`}
              />
            </div>
            <div>
              <label className="label">Max score</label>
              <input
                className="input"
                type="number"
                min="1"
                disabled={!canEdit}
                value={test.maxScore}
                onChange={(e) => updateTest(index, 'maxScore', e.target.value)}
                placeholder="10"
              />
            </div>
            <div>
              <label className="label">Test date</label>
              <input
                className="input"
                type="date"
                disabled={!canEdit}
                value={test.date || ''}
                onChange={(e) => updateTest(index, 'date', e.target.value)}
              />
            </div>
            {canEdit && tests.length > 1 && (
              <button
                type="button"
                onClick={() => removeTest(index)}
                className="btn-secondary px-3 text-red-600"
                title="Remove test"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
        <div>
          <label className="label">Tests combined out of</label>
          <input
            className="input"
            type="number"
            min="1"
            disabled={!canEdit}
            value={testsMarkMax}
            onChange={(e) => onChange(tests, e.target.value, examMax)}
            placeholder="40"
          />
          <p className="field-hint mt-1">Raw tests total: {rawTestMax || 0} pts</p>
        </div>
        <div>
          <label className="label">Exam out of</label>
          <input
            className="input"
            type="number"
            min="1"
            disabled={!canEdit}
            value={examMax}
            onChange={(e) => onChange(tests, testsMarkMax, e.target.value)}
            placeholder="40"
          />
        </div>
        <div>
          <label className="label">Bulletin total</label>
          <input className="input bg-gray-50" value={computedTotal || totalMax || ''} readOnly />
          <p className="field-hint mt-1">TEST + EX on report</p>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving setup…' : 'Save test & exam setup'}
          </button>
        </div>
      )}
    </div>
  );
}
