import { Link } from '@tanstack/react-router';
import { ChevronRight, Play } from 'lucide-react';
import { Fragment } from 'react';
import { DAY, STAGES, fmtNum, fmtTime, forecast, nextQueue, relDay } from '@/core';
import { AlertsCard } from '@/components/alerts';
import { Pf } from '@/components/bits';
import { useAppState } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card, CardHead, Empty, Tag } from '@/components/ui/primitives';
import { useAct, useNow } from '@/lib/data';
import { openVideo } from '@/lib/ui';

function Endpoint({ m, path, children }: { m: 'GET' | 'POST'; path: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-2.5 border-b border-line py-2.5 text-[13px] last:border-b-0">
      <span className={`h-fit rounded-[5px] px-1.5 py-[3px] text-center font-mono text-[11px] font-bold ${m === 'POST' ? 'bg-accent-wash text-accent-text' : 'bg-surface-3'}`}>{m}</span>
      <div><code className="font-mono text-[12.5px]">{path}</code><div className="mt-[3px] text-muted">{children}</div></div>
    </div>
  );
}
const pre = 'mt-2 overflow-x-auto rounded-[10px] border border-line bg-surface-2 px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-ink-2';

export function FactoryPage() {
  const { state, mode } = useAppState();
  const now = useNow(60_000);
  const act = useAct();
  const q = nextQueue(state, now).slice(0, 15);
  const base = mode === 'server' ? location.origin : 'http://localhost:4310';
  return (
    <>
      <Card>
        <CardHead title="Ishlab chiqarish liniyasi" sub="har bosqichdagi videolar soni" />
        <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
          {STAGES.map((s, i) => (
            <Fragment key={s.id}>
              <Link to="/ssenariylar" className="flex-[1_0_108px] rounded-[11px] border border-line bg-surface-2 p-3 hover:border-line-2">
                <div className="text-xs text-muted">{i + 1}. {s.name}</div>
                <div className="text-[26px] font-semibold tracking-[-0.02em]">{state.videos.filter((v) => v.status === s.id).length}</div>
              </Link>
              {i < STAGES.length - 1 && <ChevronRight size={16} className="shrink-0 self-center text-muted" />}
            </Fragment>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Joylash navbati" sub="worker shu tartibda joylaydi" right={
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
              <input type="checkbox" className="accent-(--accent)" checked={state.workspace.autoPublish} onChange={(e) => act.mutate({ type: 'workspace.update', payload: { autoPublish: e.target.checked } })} />
              Simulyatsiya (server o‘zi joylaydi)
            </label>} />
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="table">
              <thead><tr><th>Qachon</th><th>Platforma</th><th>Video</th><th>Tayyorlik</th><th className="r">Prognoz</th><th /></tr></thead>
              <tbody>
                {q.map((x) => {
                  const v = state.videos.find((y) => y.id === x.videoId)!;
                  const f = forecast(state, now, v, x.platform, x.scheduledAt);
                  return (
                    <tr key={x.postId}>
                      <td className="whitespace-nowrap">{relDay(x.scheduledAt, now)}, <b>{fmtTime(x.scheduledAt)}</b></td>
                      <td><Pf id={x.platform} /></td>
                      <td><button className="block max-w-[240px] truncate text-left font-medium hover:underline" onClick={() => openVideo(x.videoId)}>{x.title}</button></td>
                      <td>{x.ready ? <Tag tone="good">Tayyor</Tag> : <Tag tone={x.dueIn < DAY ? 'critical' : 'warning'}>{Math.round(x.readiness * 100)}%</Tag>}</td>
                      <td className="r">{f ? fmtNum(f.mid) : '—'}</td>
                      <td className="r"><Button size="icon-sm" variant="ghost" title="Hozir joylash" aria-label="Hozir joylash" onClick={() => confirm('Hozir joylansinmi?') && act.mutate({ type: 'post.publishNow', payload: { postId: x.postId } })}><Play size={14} /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!q.length && <Empty>Navbat bo‘sh</Empty>}
          </div>
        </Card>
        <AlertsCard state={state} now={now} limit={10} />
      </div>

      <Card className="mt-4">
        <CardHead title="API — avtomatlashtirish uchun" sub={mode === 'server' ? 'server ishlayapti' : 'demo rejimda API yo‘q — npm start bilan serverni ishga tushiring'} />
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <Endpoint m="GET" path="/api/queue/next">Keyingi tayyor post (worker uchun): sarlavha, platforma, vaqt, tavsif + hashtag</Endpoint>
            <Endpoint m="GET" path="/api/queue">To‘liq navbat, tayyorlik foizi bilan</Endpoint>
            <Endpoint m="POST" path="/api/posts/:id/published">Worker joyladi: {'{url, publishedAt}'}</Endpoint>
            <Endpoint m="POST" path="/api/posts/:id/failed">Xato bo‘ldi: {'{error}'} — panelda ogohlantirish chiqadi</Endpoint>
            <Endpoint m="POST" path="/api/posts/:id/stats">Statistika: {'{stats:{views,likes,comments,shares,saves,subs,retention}}'}</Endpoint>
            <Endpoint m="POST" path="/api/videos">Yangi video: {'{title, topic, format}'} (masalan render skriptidan)</Endpoint>
            <Endpoint m="GET" path="/api/export.csv">Barcha postlar CSV (Excel uchun)</Endpoint>
          </div>
          <div>
            <div className="text-[12.5px] text-muted">Misol: statistikani yuborish</div>
            <pre className={pre}>{`curl -X POST ${base}/api/posts/p12/stats \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -d '{"stats":{"views":15420,"likes":980,"subs":120}}'`}</pre>
            <div className="mt-3.5 text-[12.5px] text-muted">Worker (har daqiqada)</div>
            <pre className={pre}>{`npm run worker
# navbatdan tayyor postni oladi → platformaga yuklaydi
# → /published yoki /failed ga xabar beradi`}</pre>
          </div>
        </div>
      </Card>
    </>
  );
}
