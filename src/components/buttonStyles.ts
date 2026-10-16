export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800',
  secondary:
    'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 ' +
    'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
};

export function buttonClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}
