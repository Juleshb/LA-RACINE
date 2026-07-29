import { X, Plus, Pencil } from 'lucide-react';
import Modal from './Modal';
import { useTranslationOptional } from '../../context/LanguageContext';

export default function FormModeModal({
  open,
  mode = 'edit',
  title,
  subtitle,
  context,
  onClose,
  onSubmit,
  formId,
  submitLabel,
  cancelLabel,
  submitting = false,
  error,
  children,
  headerExtra,
  footerExtra,
  size = 'lg',
}) {
  const { t } = useTranslationOptional();
  const meta = mode === 'create'
    ? { badge: t('ui.addNew'), icon: Plus, accent: 'form-mode-create', badgeClass: 'form-mode-badge-create' }
    : { badge: t('ui.updateBadge'), icon: Pencil, accent: 'form-mode-edit', badgeClass: 'form-mode-badge-edit' };
  const Icon = meta.icon;
  const resolvedCancel = cancelLabel || t('ui.cancel');
  const resolvedSubmitSaving = t('ui.saving');

  return (
    <Modal open={open} onClose={onClose} size={size}>
      <div className={`form-mode-panel form-mode-panel-modal ${meta.accent}`}>
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
              aria-label={t('ui.close')}
              disabled={submitting}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && <div className="form-mode-error mx-5 mt-4">{error}</div>}

        <form id={formId} onSubmit={onSubmit} className="form-mode-body modal-form-scroll">
          {children}
        </form>

        <div className="form-mode-footer">
          {footerExtra}
          <div className="flex gap-3 ml-auto w-full sm:w-auto">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 sm:flex-none" disabled={submitting}>
              {resolvedCancel}
            </button>
            <button type="submit" form={formId} className="btn-primary flex-1 sm:flex-none disabled:opacity-50" disabled={submitting}>
              {submitting ? resolvedSubmitSaving : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
