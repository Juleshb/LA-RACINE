import {
  Award, Atom, Backpack, BookMarked, BookOpen, Bus, Calculator, FlaskConical,
  Globe, GraduationCap, Library, Lightbulb, Music, NotebookPen, Palette, PenLine,
  Pencil, Ruler, School,
} from 'lucide-react';

const FLOATERS = [
  { Icon: GraduationCap, left: '4%', size: 54, duration: 28, delay: -6, dx: 48, rot: 18 },
  { Icon: BookOpen, left: '12%', size: 40, duration: 34, delay: -18, dx: -36, rot: -14 },
  { Icon: Pencil, left: '20%', size: 34, duration: 24, delay: -9, dx: 28, rot: 22 },
  { Icon: School, left: '28%', size: 62, duration: 38, delay: -22, dx: -20, rot: 8 },
  { Icon: Globe, left: '36%', size: 44, duration: 30, delay: -4, dx: 42, rot: -16 },
  { Icon: Award, left: '44%', size: 36, duration: 26, delay: -14, dx: -30, rot: 20 },
  { Icon: Backpack, left: '52%', size: 48, duration: 33, delay: -27, dx: 24, rot: -10 },
  { Icon: Lightbulb, left: '60%', size: 32, duration: 22, delay: -8, dx: -44, rot: 16 },
  { Icon: Calculator, left: '68%', size: 40, duration: 36, delay: -16, dx: 18, rot: -18 },
  { Icon: Library, left: '76%', size: 56, duration: 40, delay: -30, dx: -26, rot: 12 },
  { Icon: Palette, left: '84%', size: 38, duration: 27, delay: -11, dx: 34, rot: -22 },
  { Icon: Bus, left: '92%', size: 46, duration: 32, delay: -20, dx: -16, rot: 10 },
  { Icon: Atom, left: '8%', size: 30, duration: 23, delay: -13, dx: 22, rot: 28 },
  { Icon: FlaskConical, left: '18%', size: 36, duration: 31, delay: -25, dx: -38, rot: -12 },
  { Icon: Music, left: '31%', size: 28, duration: 21, delay: -3, dx: 16, rot: 24 },
  { Icon: NotebookPen, left: '48%', size: 42, duration: 35, delay: -19, dx: -22, rot: 14 },
  { Icon: Ruler, left: '63%', size: 34, duration: 29, delay: -7, dx: 40, rot: -20 },
  { Icon: PenLine, left: '73%', size: 30, duration: 25, delay: -15, dx: -18, rot: 18 },
  { Icon: BookMarked, left: '88%', size: 44, duration: 37, delay: -28, dx: 26, rot: -8 },
  { Icon: GraduationCap, left: '57%', size: 28, duration: 20, delay: -2, dx: -32, rot: 26 },
];

export default function PortalEduField() {
  return (
    <div className="portal-edu-field" aria-hidden="true">
      {FLOATERS.map(({ Icon, left, size, duration, delay, dx, rot }, index) => (
        <span
          key={index}
          className="portal-edu-icon"
          style={{
            left,
            width: size,
            height: size,
            '--edu-dur': `${duration}s`,
            '--edu-delay': `${delay}s`,
            '--edu-dx': `${dx}px`,
            '--edu-rot': `${rot}deg`,
          }}
        >
          <Icon strokeWidth={1.5} />
        </span>
      ))}
    </div>
  );
}
