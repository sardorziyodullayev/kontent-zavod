import { Link2, RefreshCw } from 'lucide-react';
import { DAY, allPosts, bestSlots, fmtDur, fmtFull, fmtNum, followersAt, platformMeta, postStats, slotLabel } from '@/core';
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
