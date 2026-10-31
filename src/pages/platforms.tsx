import { ExternalLink, Link2, RefreshCw } from 'lucide-react';
import { DAY, allPosts, bestSlots, fmtDate, fmtDur, fmtFull, fmtNum, followersAt, platformMeta, postStats, slotLabel, type ExtChannel } from '@/core';
import { Pf, Sparkline, pcolor } from '@/components/bits';
import { useAppState } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card, CardHead, Tag } from '@/components/ui/primitives';
import { useAct, useNow } from '@/lib/data';

const code = 'rounded-[5px] bg-surface-2 px-[5px] py-px font-mono text-[12.5px]';

export function PlatformsPage() {
  const { state } = useAppState();
  const now = useNow(60_000);
  const act = useAct();
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.platforms.map((pl) => {
          const meta = platformMeta(pl.id);
          const f = followersAt(state, pl.id, now), f30 = followersAt(state, pl.id, now - 30 * DAY);
          const posts = allPosts(state).filter(({ p }) => p.platform === pl.id && p.status === 'published' && p.publishedAt! >= now - 30 * DAY);
          const views = posts.reduce((a, { p }) => a + postStats(p, now).views, 0);
          const best = bestSlots(state, now, pl.id, 1)[0];
          const left = pl.tokenExpiresAt ? pl.tokenExpiresAt - now : null;
          const [tone, label] = !pl.connected ? (['critical', 'Ulanmagan'] as const) : left != null && left < 7 * DAY ? (['warning', `Token ${fmtDur(left)}da tugaydi`] as const) : (['good', 'Ulangan'] as const);
          const hist: number[] = [];
          for (let d = 29; d >= 0; d -= 2) hist.push(followersAt(state, pl.id, now - d * DAY));
          const rows: [string, string][] = [['Postlar (30 kun)', String(posts.length)], ['Ko‘rishlar (30 kun)', fmtNum(views)], ['O‘rtacha / post', fmtNum(posts.length ? views / posts.length : 0)], ['Eng yaxshi vaqt', best ? slotLabel(best.slot) : '—']];
          return (
            <Card key={pl.id}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="grid size-[34px] place-items-center rounded-[9px] text-xs font-bold text-white" style={{ background: pcolor(pl.id) }}>{meta.short}</span>
                <div><b className="block text-[14.5px]">{meta.name}</b><span className="text-xs text-muted">{pl.handle}</span></div>
                <Tag tone={tone} className="ml-auto">{label}</Tag>
              </div>
              <div className="flex items-end justify-between gap-2.5">
                <div>
                  <div className="text-xs text-muted">Obunachilar</div>
                  <div className="text-[30px] font-semibold tracking-[-0.025em]">{fmtFull(f)}</div>
                  <div className="text-[12.5px] font-semibold text-good-text">▲ +{fmtFull(f - f30)} <span className="font-normal text-muted">30 kunda</span></div>
                </div>
                <Sparkline values={hist} w={110} h={36} color={pcolor(pl.id)} accent={pcolor(pl.id)} />
              </div>
              <div className="mt-3.5">
                {rows.map(([k, v]) => <div key={k} className="flex justify-between border-b border-line py-[7px] text-[13px] last:border-b-0"><span className="text-ink-2">{k}</span><b>{v}</b></div>)}
              </div>
              <div className="mt-3.5 flex gap-2">
                {pl.connected ? <>
                  <Button size="sm" onClick={() => act.mutate({ type: 'platform.update', payload: { id: pl.id, patch: { connected: true } } })}><RefreshCw size={14} />Tokenni yangilash</Button>
                  <Button size="sm" variant="danger" onClick={() => confirm(`${meta.name} uzilsinmi? Avtomatik joylash to‘xtaydi.`) && act.mutate({ type: 'platform.update', payload: { id: pl.id, patch: { connected: false } } })}>Uzish</Button>
                </> : <Button size="sm" variant="primary" onClick={() => act.mutate({ type: 'platform.update', payload: { id: pl.id, patch: { connected: true } } })}><Link2 size={14} />Ulash</Button>}
              </div>
            </Card>
          );
        })}
      </div>

      {state.channels?.map((c) => <ChannelCard key={c.key} c={c} now={now} />)}

      <Card className="mt-4">
        <CardHead title="Haqiqiy API’larga ulash" sub="server rejimida worker shu kalitlar bilan ishlaydi" />
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="table">
            <thead><tr><th>Platforma</th><th>API</th><th>Nima kerak</th><th>Statistika</th></tr></thead>
            <tbody>
              <tr><td><Pf id="youtube" /></td><td>YouTube Data API v3</td><td>Google Cloud loyiha, OAuth client, <code className={code}>youtube.upload</code> ruxsati</td><td>YouTube Analytics API</td></tr>
              <tr><td><Pf id="instagram" /></td><td>Instagram Graph API</td><td>Business/Creator akkaunt, Facebook sahifaga bog‘langan, Meta ilova</td><td><code className={code}>/insights</code></td></tr>
              <tr><td><Pf id="tiktok" /></td><td>TikTok Content Posting API</td><td>TikTok for Developers ilova, audit (ommaviy joylash uchun)</td><td>Display API</td></tr>
              <tr><td><Pf id="telegram" /></td><td>Telegram Bot API</td><td>@BotFather token, botni kanalga admin qilish</td><td>post ko‘rishlari</td></tr>
              <tr><td><Pf id="facebook" /></td><td>Facebook Graph API</td><td>Sahifa tokeni, <code className={code}>pages_manage_posts</code></td><td>Page Insights</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] text-muted">Kalitlarni <code className={code}>.env</code> faylga yozing (namuna: <code className={code}>.env.example</code>). Panel kalitlarni hech qachon brauzerga yubormaydi.</p>
      </Card>
    </>
  );
}

const PRIVACY = { public: ['good', 'Ochiq'], unlisted: ['neutral', 'Havola orqali'], private: ['warning', 'Yopiq'] } as const;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Zavod joylamaydigan, faqat statistikasi kuzatiladigan YouTube kanal (worker: YT_CHANNELS). */
function ChannelCard({ c, now }: { c: ExtChannel; now: number }) {
  const back = (days: number) => [...c.history].reverse().find((h) => h.t <= now - days * DAY) ?? c.history[0];
  const h30 = back(30);
  const spark = c.history.filter((h) => h.t >= now - 30 * DAY).map((h) => h.subs);
  const stale = now - c.syncedAt > 2 * 3600e3;
  const tiles: [string, number, number][] = [['Obunachilar', c.subscribers, c.subscribers - (h30?.subs ?? c.subscribers)], ['Ko‘rishlar', c.views, c.views - (h30?.views ?? c.views)]];
  return (
    <Card className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        {c.thumb ? <img src={c.thumb} alt="" className="size-[34px] rounded-full" /> : <span className="grid size-[34px] place-items-center rounded-full text-xs font-bold text-white" style={{ background: pcolor('youtube') }}>YT</span>}
        <div><b className="block text-[14.5px]">{c.title}</b><span className="text-xs text-muted">{c.handle} · YouTube · faqat statistika</span></div>
        <Tag tone={stale ? 'warning' : 'good'} className="ml-auto" title={new Date(c.syncedAt).toLocaleString('ru-RU')}>{stale ? 'Yangilanmayapti' : 'Yangilangan'} {fmtDur(c.syncedAt - now)}</Tag>
        <a href={`https://www.youtube.com/${c.handle.startsWith('@') ? c.handle : 'channel/' + c.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"><ExternalLink size={14} />Kanal</a>
      </div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        {tiles.map(([k, v, d]) => (
          <div key={k}>
            <div className="text-xs text-muted">{k}</div>
            <div className="text-[30px] font-semibold tracking-[-0.025em]">{fmtFull(v)}</div>
            <div className="text-[12.5px] font-semibold">{d > 0 ? <span className="text-good-text">▲ +{fmtFull(d)}</span> : <span className="text-muted">—</span>} <span className="font-normal text-muted">30 kunda</span></div>
          </div>
        ))}
        <div>
          <div className="text-xs text-muted">Videolar</div>
          <div className="text-[30px] font-semibold tracking-[-0.025em]">{c.videos.length}</div>
          <div className="text-[12.5px] text-muted">{c.videos.filter((v) => v.privacy === 'public').length} tasi ochiq</div>
        </div>
        {spark.length > 1 && <Sparkline values={spark} w={140} h={40} color={pcolor('youtube')} accent={pcolor('youtube')} />}
      </div>
      {c.videos.length > 0 && (
        <div className="-mx-5 mt-4 overflow-x-auto px-5">
          <table className="table">
            <thead><tr><th>Video</th><th>Holat</th><th>Sana</th><th>Davomiylik</th><th className="text-right">Ko‘rishlar</th><th className="text-right">Layk</th><th className="text-right">Izoh</th></tr></thead>
            <tbody>
              {c.videos.map((v) => {
                const [tone, label] = v.privacy === 'private' && v.publishAt ? (['accent', 'Rejalangan'] as const) : PRIVACY[v.privacy];
                return (
                  <tr key={v.id}>
                    <td className="max-w-[380px]"><a href={`https://youtu.be/${v.id}`} target="_blank" rel="noreferrer" className="line-clamp-1 hover:underline">{v.title}</a></td>
                    <td><Tag tone={tone}>{label}</Tag></td>
                    <td className="whitespace-nowrap">{fmtDate(v.publishAt ?? v.publishedAt)}</td>
                    <td>{mmss(v.duration)}</td>
                    <td className="text-right font-semibold">{fmtNum(v.views)}</td>
                    <td className="text-right">{fmtNum(v.likes)}</td>
                    <td className="text-right">{fmtNum(v.comments)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
