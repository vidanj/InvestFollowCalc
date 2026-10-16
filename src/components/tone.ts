export type Tone = 'positive' | 'negative' | 'neutral';

export function toneClass(tone: Tone): string {
  if (tone === 'positive') return 'text-emerald-700 dark:text-emerald-400';
  if (tone === 'negative') return 'text-red-700 dark:text-red-400';
  return '';
}

/** Gains are positive, losses negative; zero and unknown values are neutral. */
export function toneOf(value: number | null): Tone {
  if (value === null || value === 0) return 'neutral';
  return value > 0 ? 'positive' : 'negative';
}
