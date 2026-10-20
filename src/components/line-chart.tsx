// Recharts asosidagi ko'p qatorli chiziqli grafik: legenda orqali qatorlarni yoqish/o'chirish, crosshair tooltip.
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtFull, fmtNum } from '@/core';
import { useUI } from '@/lib/ui';

export interface Series { id: string; name: string; color: string; values: number[] }

/** CSS o'zgaruvchilarini haqiqiy rangga aylantiradi (SVG atributlari var() ni har doim qabul qilmaydi). */
function useResolved(colors: string[]) {
  const theme = useUI((s) => s.theme);
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    return colors.map((c) => (c.startsWith('var(') ? cs.getPropertyValue(c.slice(4, -1)).trim() || '#888' : c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, colors.join()]);
}

export function MultiLine({ labels, tipLabels, series, height = 260, total, legend = true, aria }: { labels: string[]; tipLabels?: string[]; series: Series[]; height?: number; total?: boolean; legend?: boolean; aria: string }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const colors = useResolved(series.map((s) => s.color));
  const data = useMemo(() => labels.map((label, i) => ({ label, tip: tipLabels?.[i] ?? label, ...Object.fromEntries(series.map((s) => [s.id, s.values[i]])) })), [labels, tipLabels, series]);
  const visible = series.filter((s) => !hidden[s.id]);
  const surface = useResolved(['var(--surface)'])[0];

  const TipContent = ({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as Record<string, number | string>;
    const rows = [...visible].sort((a, b) => Number(row[b.id]) - Number(row[a.id]));
    return (
      <div className="min-w-[150px] rounded-[10px] border border-line-2 bg-surface px-[11px] py-[9px] text-[12.5px] shadow-pop">
        <div className="mb-1.5 text-[11.5px] text-muted">{row.tip}</div>
        {rows.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 py-px">
            <span className="inline-flex items-center gap-[7px] text-ink-2"><i className="size-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
            <b className="font-semibold tnum">{fmtFull(Number(row[s.id]))}</b>
          </div>
        ))}
        {total && rows.length > 1 && (
          <div className="mt-[5px] flex justify-between border-t border-line pt-[5px]"><span className="text-ink-2">Jami</span><b className="tnum">{fmtFull(rows.reduce((a, s) => a + Number(row[s.id]), 0))}</b></div>
        )}
      </div>
    );
  };

  return (
    <div>
      {legend && series.length > 1 && (
        <div className="mb-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map((s) => (
            <button key={s.id} aria-pressed={!hidden[s.id]} onClick={() => setHidden((h) => ({ ...h, [s.id]: !h[s.id] }))} className="inline-flex items-center gap-[7px] py-0.5 text-[12.5px] text-ink-2 aria-[pressed=false]:opacity-40">
              <i className="h-[3px] w-3.5 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div role="img" aria-label={aria} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickFormatter={(v) => fmtNum(v)} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={TipContent} cursor={{ stroke: 'var(--line-2)', strokeWidth: 1 }} isAnimationActive={false} />
            {series.map((s, i) => !hidden[s.id] && (
              <Line key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={colors[i]} strokeWidth={2} dot={false} activeDot={{ r: 4.5, stroke: surface, strokeWidth: 2, fill: colors[i] }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
