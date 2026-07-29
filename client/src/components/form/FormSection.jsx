export default function FormSection({ title, description, children, className = '' }) {
  return (
    <div className={`form-section ${className}`}>
      {(title || description) && (
        <div className="form-section-header">
          {title && <h3 className="form-section-title">{title}</h3>}
          {description && <p className="form-section-desc">{description}</p>}
        </div>
      )}
      <div className="form-section-body">{children}</div>
    </div>
  );
}
