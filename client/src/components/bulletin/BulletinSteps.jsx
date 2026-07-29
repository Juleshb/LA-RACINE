import { CheckCircle2, Circle } from 'lucide-react';

export default function BulletinSteps({ assessments, savedAssessments, current, onSelect, course }) {
  const steps = assessments.map((a) => ({
    id: a.key,
    label: a.label || a.key,
    max: a.maxScore ?? a.max ?? 100,
    done: savedAssessments.includes(a.key),
  }));
  const doneCount = steps.filter((s) => s.done).length;
  const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  const testsMax = Number(course?.testsMarkMax) || 0;
  const examMax = Number(course?.examMax) || 0;
  const totalMax = testsMax + examMax || Number(course?.totalMax) || 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-800">{doneCount}</span> of {steps.length} assessments saved
        </p>
        <div className="flex-1 max-w-xs h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-brand-700 tabular-nums">{progress}%</span>
      </div>

      <div className="bulletin-stepper">
        {steps.map((step, i) => {
          const isActive = current === step.id;
          const isDone = step.done;
          return (
            <div key={step.id} className="bulletin-step-wrap">
              {i > 0 && (
                <div className={`bulletin-step-line ${isDone || isActive ? 'bulletin-step-line-active' : ''}`} />
              )}
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                className={`bulletin-step ${isActive ? 'bulletin-step-active' : ''} ${isDone ? 'bulletin-step-done' : ''}`}
              >
                <span className="bulletin-step-icon">
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </span>
                <span className="bulletin-step-label">
                  {step.label}
                  {step.date ? (
                    <span className="text-[11px] text-gray-500 font-normal">
                      {' '}
                      ({new Date(step.date).toLocaleDateString('fr-FR')})
                    </span>
                  ) : null}
                </span>
                <span className="bulletin-step-max">/ {step.max}</span>
              </button>
            </div>
          );
        })}
        {totalMax > 0 && (
          <div className="bulletin-step-wrap">
            <div className="bulletin-step-line bulletin-step-line-active" />
            <div className="bulletin-step bulletin-step-summary">
              <span className="bulletin-step-label">Bulletin</span>
              <span className="bulletin-step-max">
                TEST/{testsMax || '—'} · EX/{examMax || '—'} · TOT/{totalMax}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
