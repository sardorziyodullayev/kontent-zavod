// PixelMind belgisi: piksellardan "P", ichida 45° burilgan "g'oya" pikseli (brand/logo-lime.svg bilan bir xil to'r).
import { cn } from '@/lib/utils';

const GRID = ['XXXX.', 'X...X', 'X.o.X', 'X...X', 'XXXX.', 'X....', 'X....'];

export function PixelLogo({ size = 32, className, tile = true }: { size?: number; className?: string; tile?: boolean }) {
  const cell = 86, gap = 10, sq = cell - gap, w = 5 * cell - gap, h = 7 * cell - gap;
  const x0 = (800 - w) / 2 + cell * 0.12, y0 = (800 - h) / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 800 800" className={cn('shrink-0', className)} aria-hidden="true">
      {tile && <rect width="800" height="800" rx="176" fill="var(--accent)" />}
      {GRID.flatMap((row, r) => [...row].map((c, i) => {
        if (c === '.') return null;
        const x = x0 + i * cell, y = y0 + r * cell;
        if (c === 'o') {
          const d = sq * 0.78, cx = x + sq / 2, cy = y + sq / 2;
          return <rect key={`${r}-${i}`} x={cx - d / 2} y={cy - d / 2} width={d} height={d} rx={7} fill="var(--accent-ink)" transform={`rotate(45 ${cx} ${cy})`} />;
        }
        return <rect key={`${r}-${i}`} x={x} y={y} width={sq} height={sq} rx={12} fill="var(--accent-ink)" />;
      }))}
    </svg>
  );
}

export const BRAND = { name: 'PixelMind', product: 'PixelMind Studio', tagline: 'AI kontent zavodi', handle: '@pixelminduz' } as const;
