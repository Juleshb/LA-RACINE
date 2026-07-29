import { Icon } from '@iconify/react';

/** Semantic Iconify icons — MDI set for clear, child-friendly meaning */
export const APP_ICONS = {
  home: 'mdi:home',
  homework: 'mdi:book-open-page-variant',
  library: 'mdi:bookshelf',
  learning: 'mdi:school',
  book: 'mdi:book-open-variant',
  video: 'mdi:television-play',
  play: 'mdi:play-circle',
  volume: 'mdi:volume-high',
  fullscreen: 'mdi:fullscreen',
  exitFullscreen: 'mdi:fullscreen-exit',
  pencil: 'mdi:pencil',
  star: 'mdi:star',
  trophy: 'mdi:trophy',
  check: 'mdi:check-circle',
  image: 'mdi:image',
  pdf: 'mdi:file-pdf-box',
  clipboard: 'mdi:clipboard-text',
  film: 'mdi:movie-open',
  celebrate: 'mdi:party-popper',
  questions: 'mdi:help-circle',
  arrowRight: 'mdi:arrow-right',
  arrowLeft: 'mdi:arrow-left',
  refresh: 'mdi:refresh',
  wave: 'mdi:hand-wave',
  present: 'mdi:check-circle',
  absent: 'mdi:home-outline',
  late: 'mdi:clock-alert',
  clock: 'mdi:clock-outline',
  excused: 'mdi:file-document-edit-outline',
  unknown: 'mdi:help-circle-outline',
  lesson: 'mdi:play-box',
  language: 'mdi:translate',
  wrong: 'mdi:close-circle',
  close: 'mdi:close',
  zoomIn: 'mdi:magnify-plus',
  zoomOut: 'mdi:magnify-minus',
  fitPage: 'mdi:fit-to-page',
  map: 'mdi:map-marker',
  mapOutline: 'mdi:map-marker-outline',
  directions: 'mdi:directions',
  phone: 'mdi:phone',
  email: 'mdi:email-outline',
  website: 'mdi:web',
  school: 'mdi:school-outline',
  externalLink: 'mdi:open-in-new',
  send: 'mdi:send',
  chat: 'mdi:message-text',
  menu: 'mdi:menu',
  chevronDown: 'mdi:chevron-down',
  whatsapp: 'mdi:whatsapp',
  x: 'simple-icons:x',
  tiktok: 'simple-icons:tiktok',
  facebook: 'mdi:facebook',
  instagram: 'mdi:instagram',
  youtube: 'mdi:youtube',
};

export default function AppIcon({ name, className = 'w-6 h-6', ...props }) {
  const icon = APP_ICONS[name];
  if (!icon) return null;
  return <Icon icon={icon} className={className} aria-hidden {...props} />;
}

export function IconLabel({ icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <AppIcon name={icon} className="w-5 h-5 shrink-0" />
      <span>{children}</span>
    </span>
  );
}
