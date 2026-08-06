import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { colors } from '../theme';

type MCIName = NonNullable<ComponentProps<typeof MaterialCommunityIcons>['name']>;

/**
 * Child-friendly icons using Iconify’s MDI set
 * (MaterialCommunityIcons = same glyphs as Iconify `mdi:*`).
 */
export const ICONS = {
  home: 'home-heart',
  homework: 'notebook',
  ai: 'robot-happy',
  live: 'video',
  library: 'book',
  learn: 'school',
  more: 'view-grid',
  star: 'star',
  trophy: 'trophy',
  rocket: 'rocket-launch',
  sparkles: 'star-four-points',
  party: 'party-popper',
  sleep: 'sleep',
  link: 'link-variant',
  smile: 'emoticon-happy',
  mail: 'email',
  clock: 'clock-outline',
  check: 'check-circle',
  refresh: 'refresh',
  rainbow: 'weather-partly-cloudy',
  send: 'send',
  logout: 'logout',
  sad: 'emoticon-sad',
  school: 'town-hall',
  user: 'account-circle',
  wave: 'hand-wave',
  magic: 'auto-fix',
  play: 'play-circle',
  chevron: 'chevron-right',
  trash: 'trash-can-outline',
  volume: 'volume-high',
  volumeOff: 'volume-off',
  stop: 'stop-circle',
  mic: 'microphone',
  close: 'close-circle',
  external: 'open-in-new',
  film: 'youtube',
  image: 'image',
  pdf: 'file-pdf-box',
  clipboard: 'clipboard-text',
} as const satisfies Record<string, MCIName>;

export type AppIconName = keyof typeof ICONS;

export function AppIcon({
  name,
  size = 24,
  color = colors.brandDark,
}: {
  name: AppIconName;
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name={ICONS[name]} size={size} color={color} />;
}
