import type { ButtonHTMLAttributes, ReactNode, SVGProps } from 'react';
import { useI18n } from '../lib/i18n';

export function Header({
  title,
  backHref,
  onBack,
  right,
}: {
  title: ReactNode;
  backHref?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <header className="safe-top sticky top-0 z-10 border-b border-pink-200/50 bg-white/80 backdrop-blur-md dark:border-pink-950/50 dark:bg-[#191118]/85">
      <div className="flex h-14 items-center gap-2 px-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t.back}
            className="-ml-1 grid size-10 place-items-center rounded-full hover:bg-pink-100/70 dark:hover:bg-pink-950/50"
          >
            <Icon.ChevronLeft className="size-6" />
          </button>
        ) : backHref ? (
          <a
            href={backHref}
            aria-label={t.back}
            className="-ml-1 grid size-10 place-items-center rounded-full hover:bg-pink-100/70 dark:hover:bg-pink-950/50"
          >
            <Icon.ChevronLeft className="size-6" />
          </a>
        ) : (
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="ml-1 size-8 rounded-lg shadow-xs" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        <div className="flex items-center gap-1">{right}</div>
      </div>
    </header>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-sm shadow-pink-500/25 hover:bg-accent-strong active:scale-[0.98]',
  secondary:
    'bg-white text-zinc-900 ring-1 ring-pink-200/80 hover:bg-pink-50/70 dark:bg-[#261a24] dark:text-pink-50 dark:ring-pink-900/50 dark:hover:bg-pink-950/60',
  ghost: 'text-zinc-700 hover:bg-pink-100/60 dark:text-pink-200 dark:hover:bg-pink-950/50',
  danger: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950',
};

export function Button({
  variant = 'secondary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition disabled:opacity-40 ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  // Default size & colours only when the caller doesn't set its own (Tailwind can't resolve conflicting classes by order).
  const size = /(^|\s)size-/.test(className) ? '' : 'size-10';
  const text = /(^|\s)text-/.test(className) ? '' : 'text-zinc-700 dark:text-zinc-300';
  const hover = /(^|\s)hover:bg-/.test(className) ? '' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid place-items-center rounded-full ${size} ${text} ${hover} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, color = 'var(--color-accent)' }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-pink-100 dark:bg-pink-950/60">
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: color }}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-zinc-300 dark:bg-zinc-700'}`}
      >
        <span
          className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
}

const base = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const Icon = {
  ChevronLeft: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  Plus: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Settings: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  Camera: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  ),
  Image: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  ),
  Trash: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  ),
  X: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  Check: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  Undo: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  ),
  Play: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="m6 3 14 9-14 9V3Z" />
    </svg>
  ),
  Pencil: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  ),
  Search: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Download: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  ),
  Crop: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  ),
  RotateCw: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  ),
  Paw: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
      <ellipse cx="12" cy="16.5" rx="5.2" ry="4.2" />
      <circle cx="6.2" cy="10.5" r="2.2" />
      <circle cx="9.8" cy="8" r="2.2" />
      <circle cx="14.2" cy="8" r="2.2" />
      <circle cx="17.8" cy="10.5" r="2.2" />
    </svg>
  ),
};

export function CatMascot({
  mood = 'curious',
  className = 'size-28',
}: {
  mood?: 'curious' | 'cheer';
  className?: string;
}) {
  return (
    <svg viewBox="0 0 160 140" className={`mx-auto select-none ${className}`} aria-hidden>
      {mood === 'cheer' && (
        <g fill="#f472b6">
          <path d="M24 34 C24 29 17 29 17 34 C17 39 24 43 24 43 C24 43 31 39 31 34 C31 29 24 29 24 34 Z" />
          <path d="M136 28 C136 24 130 24 130 28 C130 32 136 36 136 36 C136 36 142 32 142 28 C142 24 136 24 136 28 Z" />
          <circle cx="34" cy="18" r="3" fill="#fbcfe8" />
          <circle cx="126" cy="46" r="3.5" fill="#fbcfe8" />
        </g>
      )}
      {/* Ears + Head */}
      <path
        d="M42 54 L36 16 L66 38 Q80 34 94 38 L124 16 L118 54 Q128 72 124 92 Q118 122 80 124 Q42 122 36 92 Q32 72 42 54 Z"
        fill="#ffffff"
        stroke="#f9a8d4"
        strokeWidth="3.5"
      />
      {/* Pink inner ears */}
      <path d="M47 50 L43 26 L63 41 Z" fill="#f9a8d4" />
      <path d="M113 50 L117 26 L97 41 Z" fill="#f9a8d4" />
      {/* Rosy cheeks */}
      <ellipse cx="54" cy="84" rx="9" ry="5.5" fill="#f9a8d4" opacity="0.85" />
      <ellipse cx="106" cy="84" rx="9" ry="5.5" fill="#f9a8d4" opacity="0.85" />
      {/* Eyes */}
      {mood === 'cheer' ? (
        <g stroke="#3f1d38" strokeWidth="3.5" fill="none" strokeLinecap="round">
          <path d="M56 72 Q63 63 70 72" />
          <path d="M90 72 Q97 63 104 72" />
        </g>
      ) : (
        <g>
          <circle cx="63" cy="70" r="6.5" fill="#3f1d38" />
          <circle cx="61" cy="68" r="2.2" fill="#ffffff" />
          <circle cx="97" cy="70" r="6.5" fill="#3f1d38" />
          <circle cx="95" cy="68" r="2.2" fill="#ffffff" />
        </g>
      )}
      {/* Pink nose & :3 mouth */}
      <path d="M75 82 Q80 79 85 82 L80 89 Z" fill="#ec4899" />
      <path
        d="M80 88 Q75 96 67 93 M80 88 Q85 96 93 93"
        stroke="#3f1d38"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* Whiskers */}
      <path
        d="M44 77 L26 73 M43 85 L24 86 M116 77 L134 73 M117 85 L136 86"
        stroke="#f472b6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Paws */}
      <ellipse cx="58" cy="122" rx="11" ry="8" fill="#ffffff" stroke="#f9a8d4" strokeWidth="3" />
      <ellipse cx="102" cy="122" rx="11" ry="8" fill="#ffffff" stroke="#f9a8d4" strokeWidth="3" />
    </svg>
  );
}
