import { Download, LogOut, RefreshCw, Trash2, Upload } from 'lucide-react';
import { allPosts, fmtDate, fmtTime, toCSV, type State } from '@/core';
import { useAppState } from '@/components/shell';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, CardHead, Field, Segmented } from '@/components/ui/primitives';
import { logout, useAct, useReplaceState } from '@/lib/data';
import { setTheme } from '@/lib/ui';
import { download, ls, today } from '@/lib/utils';

export function SettingsPage() {
  const { state, mode } = useAppState();
  const act = useAct();
  const replace = useReplaceState();
  const theme = (ls.get('kz-theme') ?? 'dark') as 'system' | 'dark' | 'light';
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHead title="Ish joyi" />
        <form className="grid gap-3.5" onSubmit={(e) => { e.preventDefault(); act.mutate({ type: 'workspace.update', payload: { name: String(new FormData(e.currentTarget).get('name')).trim() } }); }}>
          <Field label="Nomi"><input className="input" name="name" defaultValue={state.workspace.name} maxLength={40} /></Field>
          <Field label="Vaqt mintaqasi"><input className="input" value="Asia/Tashkent (UTC+5)" disabled /></Field>
          <div><Button type="submit" variant="primary">Saqlash</Button></div>
        </form>
      </Card>
      <Card>
        <CardHead title="Maqsadlar" />
        <form className="grid gap-3.5" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          act.mutate({ type: 'goals.update', payload: { monthlySubs: Number(fd.get('monthlySubs')), monthlyViews: Number(fd.get('monthlyViews')), weeklyVideos: Number(fd.get('weeklyVideos')) } });
        }}>
          <Field label="Oylik yangi obunachilar"><input className="input" type="number" min={0} name="monthlySubs" defaultValue={state.goals.monthlySubs} /></Field>
          <Field label="Oylik ko‘rishlar"><input className="input" type="number" min={0} name="monthlyViews" defaultValue={state.goals.monthlyViews} /></Field>
          <Field label="Haftalik videolar"><input className="input" type="number" min={0} name="weeklyVideos" defaultValue={state.goals.weeklyVideos} /></Field>
          <div><Button type="submit" variant="primary">Saqlash</Button></div>
        </form>
      </Card>
      <Card>
        <CardHead title="Ko‘rinish" />
        <Segmented label="Mavzu" value={theme} onChange={setTheme} options={[{ value: 'system', label: 'Tizim' }, { value: 'dark', label: 'Qorong‘i' }, { value: 'light', label: 'Yorug‘' }]} />
        <p className="mt-3 text-[12.5px] text-muted">Tezkor tugmalar: <b>Ctrl K</b> qidirish, <b>N</b> yangi video, <b>Esc</b> yopish.</p>
        {mode === 'server' && ls.get('kz-token') && <Button className="mt-3" onClick={() => { logout(); location.reload(); }}><LogOut size={16} />Paneldan chiqish</Button>}
      </Card>
      <Card>
        <CardHead title="Ma’lumotlar" sub={mode === 'server' ? 'serverda: zavod.db (SQLite)' : 'brauzer xotirasida (demo)'} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => download(`kontent-zavod-${today()}.json`, JSON.stringify(state, null, 1), 'application/json')}><Download size={16} />JSON eksport</Button>
          <Button onClick={() => download(`kontent-zavod-${today()}.csv`, '﻿' + toCSV(state, Date.now()), 'text/csv;charset=utf-8')}><Download size={16} />CSV eksport</Button>
          <label className={buttonClass()}>
            <Upload size={16} />JSON import
            <input type="file" accept="application/json" hidden onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const data = JSON.parse(await file.text()) as State;
                if (!Array.isArray(data.videos)) throw new Error('Fayl formati noto‘g‘ri');
                await replace(data);
              } catch (err) { alert((err as Error).message); }
            }} />
          </label>
          <Button variant="danger" onClick={() => confirm('Barcha videolar, postlar va statistika o‘chirilsinmi? Avval JSON eksport qilib oling.') && replace('empty')}><Trash2 size={16} />Hammasini tozalash</Button>
          {mode === 'demo' && <Button variant="danger" onClick={() => confirm('Barcha ma’lumotlar demo holatiga qaytarilsinmi?') && replace('reset')}><RefreshCw size={16} />Demo ma’lumotlarni tiklash</Button>}
        </div>
        <p className="mt-3 text-[12.5px] text-muted">Videolar: {state.videos.length} · Postlar: {allPosts(state).length}{state.updatedAt ? ` · Oxirgi yangilanish: ${fmtDate(state.updatedAt)} ${fmtTime(state.updatedAt)}` : ''}</p>
      </Card>
    </div>
  );
}
