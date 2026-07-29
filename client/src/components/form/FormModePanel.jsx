import { X, Plus, Pencil } from 'lucide-react';

const MODE_META = {
  create: {
    badge: 'Add new',
    icon: Plus,
    accent: 'form-mode-create',
    badgeClass: 'form-mode-badge-create',
  },
  edit: {
    badge: 'Update',
    icon: Pencil,
    accent: 'form-mode-edit',
    badgeClass: 'form-mode-badge-edit',
  },
};

export default function FormModePanel({
  mode = 'create',
  title,
  subtitle,
  context,
  onClose,
  onSubmit,
  formId,
  submitLabel,
  cancelLabel = 'Cancel',
  submitting = false,
  error,
  children,
  headerExtra,
  footerExtra,
}) {
  const meta = MODE_META[mode] || MODE_META.create;
  const Icon = meta.icon;

  return (
    <div className={`form-mode-panel ${meta.accent} mb-6`} id="active-form-panel">
      <div className="form-mode-panel-header">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`form-mode-icon ${meta.badgeClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`form-mode-badge ${meta.badgeClass}`}>{meta.badge}</span>
              {context && <span className="form-mode-context">{context}</span>}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            className="form-mode-close"
            aria-label="Close form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="form-mode-error">{error}</div>
      )}

      <form id={formId} onSubmit={onSubmit} className="form-mode-body">
        {children}
      </form>

      <div className="form-mode-footer">
        {footerExtra}
        <div className="flex gap-3 ml-auto">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
            {cancelLabel}
          </button>
          <button type="submit" form={formId} className="btn-primary disabled:opacity-50" disabled={submitting}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
