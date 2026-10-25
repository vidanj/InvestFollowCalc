import type { BarShapeProps } from 'recharts';

const GAIN = 'var(--series-gain)';
const LOSS = 'var(--series-loss)';
const RADIUS = 4;

/** Bar with a 4px rounded data-end and a square baseline end, colored by sign (diverging). */
export function RoundedBar({ x, y, width, height, value, isActive }: BarShapeProps) {
  const amount = Array.isArray(value) ? value[1] - value[0] : value;
  const top = Math.min(y, y + height);
  const h = Math.abs(height);
  if (h === 0 || width <= 0) return null;

  const r = Math.min(RADIUS, h, width / 2);
  const right = x + width;
  const bottom = top + h;
  const d =
    amount >= 0
      ? `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${right - r} Q${right},${top} ${right},${top + r} V${bottom} Z`
      : `M${x},${top} H${right} V${bottom - r} Q${right},${bottom} ${right - r},${bottom} H${x + r} Q${x},${bottom} ${x},${bottom - r} Z`;

  return <path d={d} fill={amount >= 0 ? GAIN : LOSS} fillOpacity={isActive ? 0.8 : 1} />;
}
