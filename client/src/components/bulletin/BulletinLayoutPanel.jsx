import { useState } from 'react';
import { Plus, Settings2, ChevronDown, ChevronUp, GripVertical, Trash2, Save, ArrowRight } from 'lucide-react';

export default function BulletinLayoutPanel({
  className: classLabel,
  bulletinConfig,
  bulletinPresets,
  bulletinPreset,
  onPresetChange,
  customAssessments,
  onCustomAssessmentsChange,
  onSave,
  saving,
  message,
}) {
  const [open, setOpen] = useState(true);

  const addCustomAssessment = () => {
    onCustomAssessmentsChange([
      ...customAssessments,
      { key: `A${customAssessments.length + 1}`, label: 'New', maxField: 'custom', customMax: 20, fallbackMax: 20 },
    ]);
  };

  const updateRow = (i, patch) => {
    const next = [...customAssessments];
    next[i] = { ...next[i], ...patch };
    onCustomAssessmentsChange(next);
  };

  const removeRow = (i) => {
    onCustomAssessmentsChange(customAssessments.filter((_, j) => j !== i));
  };

  const activeAssessments = bulletinPreset === 'CUSTOM'
    ? customAssessments
    : bulletinConfig?.assessments || [];

  return (
    <div className="bulletin-layout-panel mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="bulletin-panel-icon">
            <Settings2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">Bulletin layout · {classLabel}</h2>
            <p className="text-sm text-gray-500 truncate">
              How marks are recorded and shown on the report for this class only
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="mt-5 pt-5 border-t border-gray-100 space-y-5">
          <div>
            <p className="section-title mb-3">Choose preset</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {bulletinPresets.map((p) => (
                <button
                  key={p.preset}
                  type="button"
                  onClick={() => onPresetChange(p.preset)}
                  className={`bulletin-preset-card ${bulletinPreset === p.preset ? 'bulletin-preset-card-active' : ''}`}
                >
                  <p className="font-medium text-sm text-gray-900 text-left">{p.label}</p>
                  <p className="text-xs text-gray-500 mt-1 text-left">{p.assessmentCount} columns</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.assessmentKeys.map((k) => (
                      <span key={k} className="layout-flow-chip">{k}</span>
                    ))}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => onPresetChange('CUSTOM')}
                className={`bulletin-preset-card ${bulletinPreset === 'CUSTOM' ? 'bulletin-preset-card-active' : ''}`}
              >
                <p className="font-medium text-sm text-gray-900 text-left">Custom columns</p>
                <p className="text-xs text-gray-500 mt-1 text-left">Arrange your own mark columns</p>
              </button>
            </div>
          </div>

          {bulletinPreset !== 'CUSTOM' && bulletinConfig && (
            <div className="bulletin-preview-bar">
              <span className="text-sm text-gray-600">Recording flow:</span>
              <div className="flex flex-wrap items-center gap-1">
                {bulletinConfig.assessments.map((a, i) => (
                  <span key={a.key} className="flex items-center gap-1">
                    <span className="layout-flow-chip layout-flow-chip-lg">{a.label || a.key}</span>
                    {i < bulletinConfig.assessments.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {bulletinPreset === 'CUSTOM' && (
            <div className="bulletin-custom-editor">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">Custom columns (drag order by editing)</p>
                <button type="button" onClick={addCustomAssessment} className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add column
                </button>
              </div>
              <div className="space-y-2">
                {customAssessments.map((row, i) => (
                  <div key={i} className="bulletin-custom-row">
                    <GripVertical className="w-4 h-4 text-gray-300 shrink-0 hidden sm:block" />
                    <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
                    <input
                      className="input input-sm"
                      placeholder="Key"
                      value={row.key}
                      onChange={(e) => updateRow(i, { key: e.target.value.toUpperCase() })}
                    />
                    <input
                      className="input input-sm"
                      placeholder="Label"
                      value={row.label}
                      onChange={(e) => updateRow(i, { label: e.target.value })}
                    />
                    <select
                      className="input input-sm"
                      value={row.maxField || 'custom'}
                      onChange={(e) => updateRow(i, { maxField: e.target.value })}
                    >
                      <option value="test1Max">Course · T1 max</option>
                      <option value="test2Max">Course · T2 max</option>
                      <option value="examMax">Course · EX max</option>
                      <option value="totalMax">Course · Total</option>
                      <option value="custom">Fixed max</option>
                    </select>
                    <input
                      className="input input-sm w-20"
                      type="number"
                      placeholder="Max"
                      value={row.maxField === 'custom' ? (row.customMax || '') : (row.fallbackMax || '')}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        if (row.maxField === 'custom') updateRow(i, { customMax: val });
                        else updateRow(i, { fallbackMax: val });
                      }}
                    />
                    <button
                      type="button"
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30"
                      disabled={customAssessments.length <= 1}
                      onClick={() => removeRow(i)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="flex flex-wrap gap-1">
              {activeAssessments.map((a, i) => (
                <span key={a.key} className="flex items-center gap-1">
                  <span className="layout-flow-chip">{a.label || a.key}</span>
                  {i < activeAssessments.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                </span>
              ))}
            </div>
            <button type="button" onClick={onSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save layout'}
            </button>
          </div>

          {message && (
            <p className={`text-sm ${message.toLowerCase().includes('saved') ? 'text-brand-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
