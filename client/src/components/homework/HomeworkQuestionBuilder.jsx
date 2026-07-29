import { Plus, Trash2 } from 'lucide-react';

const QUESTION_TYPES = [
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple choice' },
  { value: 'SHORT_ANSWER', label: 'Short answer' },
];

function emptyQuestion() {
  return {
    type: 'TRUE_FALSE',
    prompt: '',
    options: ['', '', '', ''],
    correctAnswer: 'true',
    points: 1,
  };
}

export function createEmptyQuestion() {
  return emptyQuestion();
}

export default function HomeworkQuestionBuilder({ questions, onChange }) {
  const updateQuestion = (index, patch) => {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const addQuestion = () => onChange([...questions, emptyQuestion()]);

  const removeQuestion = (index) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Questions (auto-marked)</h3>
        <button type="button" onClick={addQuestion} className="btn-secondary text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add question
        </button>
      </div>

      {questions.length === 0 && (
        <p className="text-sm text-gray-500">No questions yet. Add true/false, multiple choice, or short answer.</p>
      )}

      {questions.map((q, index) => (
        <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-700">Question {index + 1}</p>
            <button type="button" onClick={() => removeQuestion(index)} className="text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={q.type}
                onChange={(e) => {
                  const type = e.target.value;
                  const patch = { type };
                  if (type === 'TRUE_FALSE') patch.correctAnswer = 'true';
                  if (type === 'MULTIPLE_CHOICE') patch.correctAnswer = '0';
                  updateQuestion(index, patch);
                }}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Points</label>
              <input
                className="input"
                type="number"
                min="1"
                value={q.points}
                onChange={(e) => updateQuestion(index, { points: Number(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div>
            <label className="label">Question *</label>
            <textarea
              className="input"
              rows={2}
              required
              value={q.prompt}
              onChange={(e) => updateQuestion(index, { prompt: e.target.value })}
            />
          </div>

          {q.type === 'TRUE_FALSE' && (
            <div>
              <label className="label">Correct answer</label>
              <select
                className="input max-w-xs"
                value={q.correctAnswer}
                onChange={(e) => updateQuestion(index, { correctAnswer: e.target.value })}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </div>
          )}

          {q.type === 'MULTIPLE_CHOICE' && (
            <div className="space-y-2">
              <label className="label">Choices (mark the correct one)</label>
              {(q.options || []).map((opt, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${index}`}
                    checked={String(q.correctAnswer) === String(optIndex)}
                    onChange={() => updateQuestion(index, { correctAnswer: String(optIndex) })}
                  />
                  <input
                    className="input flex-1"
                    placeholder={`Option ${optIndex + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const options = [...(q.options || [])];
                      options[optIndex] = e.target.value;
                      updateQuestion(index, { options });
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {q.type === 'SHORT_ANSWER' && (
            <div>
              <label className="label">Correct answer(s)</label>
              <input
                className="input"
                placeholder="Use | for multiple accepted answers, e.g. paris|Paris"
                value={q.correctAnswer}
                onChange={(e) => updateQuestion(index, { correctAnswer: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Not case sensitive. Separate synonyms with |</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
