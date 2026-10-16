const WIDTH = 72;
const HEIGHT = 28;
const PAD = 5; // room for the end dot and its surface ring

/**
 * Tiny balance trend next to an account name. Decorative: the name, balance and gain are written
 * right beside it, so it is hidden from assistive tech.
 */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (WIDTH - PAD * 2);
    const y = HEIGHT - PAD - ((v - min) / span) * (HEIGHT - PAD * 2);
    return [x, y] as const;
  });
  const [endX, endY] = points[points.length - 1] ?? [0, 0];

  return (
    <svg
      aria-hidden="true"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="shrink-0"
    >
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={endX}
        cy={endY}
        r={4}
        fill={color}
        stroke="var(--chart-surface)"
        strokeWidth={2}
      />
    </svg>
  );
}
