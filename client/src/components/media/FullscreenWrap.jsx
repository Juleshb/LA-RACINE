import AppIcon, { IconLabel } from '../icons/AppIcon';
import useFullscreen from '../../hooks/useFullscreen';

export default function FullscreenWrap({
  children,
  className = '',
  contentClassName = '',
  label = 'View full screen',
  exitLabel = 'Exit full screen',
}) {
  const { ref, active, toggle } = useFullscreen();

  return (
    <div
      ref={ref}
      className={`fullscreen-wrap ${active ? 'fullscreen-wrap-active' : ''} ${className}`}
    >
      <button
        type="button"
        onClick={toggle}
        className="fullscreen-btn"
        aria-label={active ? exitLabel : label}
      >
        <AppIcon name={active ? 'exitFullscreen' : 'fullscreen'} className="w-4 h-4" />
        <span>{active ? 'Exit full screen' : 'Full screen'}</span>
      </button>
      <div className={`fullscreen-content ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}

export { IconLabel };
