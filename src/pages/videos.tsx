import { useNavigate, useSearch } from '@tanstack/react-router';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATS, PLATFORMS, STAGES, TOPICS, fmtDate, fmtFull, fmtTime, pct, toCSV, videoStats, type PlatformId } from '@/core';
import { PChips, PostTag, StageTag, Thumb } from '@/components/bits';
import { useAppState } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card, CardHead } from '@/components/ui/primitives';
import { useNow } from '@/lib/data';
import { openVideo } from '@/lib/ui';
import { download, today } from '@/lib/utils';

type SortKey = 'date' | 'views' | 'er' | 'ret' | 'subs' | 'title';
export interface VideoSearch { q?: string; platform?: string; topic?: string; format?: string; status?: string; sort?: SortKey; dir?: 1 | -1 }

/** Filtrlar URL'da saqlanadi — havolani ulashsangiz o'sha ko'rinish ochiladi. */
export const videoSearch = (s: Record<string, unknown>): VideoSearch => ({
  q: typeof s.q === 'string' && s.q ? s.q : undefined,
  platform: typeof s.platform === 'string' ? s.platform : undefined,
  topic: typeof s.topic === 'string' ? s.topic : undefined,
  format: typeof s.format === 'string' ? s.format : undefined,
  status: typeof s.status === 'string' ? s.status : undefined,
  sort: ['date', 'views', 'er', 'ret', 'subs', 'title'].includes(s.sort as string) ? (s.sort as SortKey) : undefined,
  dir: s.dir === 1 ? 1 : s.dir === -1 ? -1 : undefined,
});

export function VideosPage() {
  const { state } = useAppState();
  const now = useNow(60_000);
  const search = useSearch({ from: '/videolar' });
  const navigate = useNavigate({ from: '/videolar' });
  const set = (patch: Partial<VideoSearch>) => navigate({ search: (s: VideoSearch) => ({ ...s, ...patch }), replace: true });
  const [limit, setLimit] = useState(40);
  const sort = search.sort ?? 'date', dir = search.dir ?? -1;

  const rows = useMemo(() => {
    const q = (search.q ?? '').trim().toLowerCase();
    return state.videos
      .filter((v) => (!q || v.title.toLowerCase().includes(q) || v.topic.toLowerCase().includes(q))
        && (!search.platform || v.posts.some((p) => p.platform === search.platform))
        && (!search.topic || v.topic === search.topic) && (!search.format || v.format === search.format) && (!search.status || v.status === search.status))
      .map((v) => {
        const posts = search.platform ? v.posts.filter((p) => p.platform === search.platform) : v.posts;
        const s = videoStats(posts, now);
        const pubs = posts.filter((p) => p.publishedAt).map((p) => p.publishedAt!);
        const sch = posts.filter((p) => p.status === 'scheduled').map((p) => p.scheduledAt);
        const date = pubs.length ? Math.min(...pubs) : sch.length ? Math.min(...sch) : v.createdAt;
        return { v, s, date, posts, scheduled: !pubs.length && sch.length > 0 };
      })
      .sort((a, b) => {
        const val = (r: typeof a) => ({ date: r.date, views: r.s.views, er: r.s.er, ret: r.s.retention, subs: r.s.subs, title: r.v.title })[sort];
        return (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir;
      });
  }, [state, now, search, sort, dir]);
  const tot = rows.reduce((a, r) => ({ views: a.views + r.s.views, subs: a.subs + r.s.subs }), { views: 0, subs: 0 });

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`cursor-pointer select-none hover:text-ink ${right ? 'r' : ''}`} aria-sort={sort === k ? (dir > 0 ? 'ascending' : 'descending') : 'none'} onClick={() => set({ sort: k, dir: sort === k ? (dir === 1 ? -1 : 1) : -1 })}>
      {label}{sort === k ? (dir > 0 ? ' ↑' : ' ↓') : ''}
    </th>
  );
  const dash = <span className="text-muted">—</span>;
  const selCls = 'input !h-[34px] !w-auto';

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input !h-[34px] min-w-0 flex-[1_1_220px]" type="search" placeholder="Sarlavha yoki mavzu bo‘yicha qidirish…" aria-label="Qidirish" value={search.q ?? ''} onChange={(e) => set({ q: e.target.value || undefined })} />
        <select className={selCls} aria-label="Platforma" value={search.platform ?? ''} onChange={(e) => set({ platform: e.target.value || undefined })}><option value="">Barcha platformalar</option>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className={selCls} aria-label="Mavzu" value={search.topic ?? ''} onChange={(e) => set({ topic: e.target.value || undefined })}><option value="">Barcha mavzular</option>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
        <select className={selCls} aria-label="Format" value={search.format ?? ''} onChange={(e) => set({ format: e.target.value || undefined })}><option value="">Barcha formatlar</option>{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        <select className={selCls} aria-label="Holat" value={search.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })}><option value="">Barcha holatlar</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <Button onClick={() => download(`kontent-zavod-${today()}.csv`, '﻿' + toCSV(state, now), 'text/csv;charset=utf-8')}><Download size={16} />CSV</Button>
      </div>
      <Card>
        <CardHead title={`${rows.length} ta video`} sub={`${fmtFull(tot.views)} ko‘rish · +${fmtFull(tot.subs)} obunachi`} />
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="table">
            <thead><tr><Th k="title" label="Video" /><th>Platformalar</th><Th k="date" label="Joylangan / reja" /><Th k="views" label="Ko‘rishlar" right /><Th k="er" label="ER" right /><Th k="ret" label="Tomosha %" right /><Th k="subs" label="+Obunachi" right /><th>Holat</th></tr></thead>
            <tbody>
              {rows.slice(0, limit).map((r) => (
                <tr key={r.v.id} className="click" onClick={() => openVideo(r.v.id)}>
                  <td><div className="flex min-w-[240px] items-center gap-3"><Thumb v={r.v} /><div className="min-w-0"><span className="block max-w-[340px] truncate font-medium">{r.v.title}</span><span className="text-xs text-muted">{r.v.topic} · {r.v.format === 'long' ? 'uzun' : 'qisqa'}</span></div></div></td>
                  <td>{r.posts.length ? <PChips ids={r.posts.map((p) => p.platform as PlatformId)} /> : dash}</td>
                  <td className="whitespace-nowrap">{r.v.status === 'idea' && !r.posts.length ? dash : <>{fmtDate(r.date, { weekday: true })}, <b>{fmtTime(r.date)}</b>{r.scheduled && <span className="text-muted"> (reja)</span>}</>}</td>
                  <td className="r">{r.s.views ? fmtFull(r.s.views) : dash}</td>
                  <td className="r">{r.s.views ? pct(r.s.er) : dash}</td>
                  <td className="r">{r.s.views ? pct(r.s.retention, 0) : dash}</td>
                  <td className="r">{r.s.views ? `+${fmtFull(r.s.subs)}` : dash}</td>
                  <td>{r.posts.some((p) => p.status === 'failed' || p.status === 'missed') ? <PostTag s="failed" /> : <StageTag s={r.v.status} />}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="py-6 text-center text-muted">Hech narsa topilmadi</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > limit && <div className="mt-3.5 text-center"><Button onClick={() => setLimit(limit + 40)}>Yana {Math.min(40, rows.length - limit)} ta ko‘rsatish</Button></div>}
      </Card>
    </>
  );
}
