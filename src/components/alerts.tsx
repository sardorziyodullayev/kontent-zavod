import { AlertTriangle, Clock, Link2, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { alerts as getAlerts, type AlertLevel, type State } from '@/core';
import { useAct } from '@/lib/data';
import { openModal, openVideo } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Card, CardHead, Empty } from './ui/primitives';

const ICON: Record<AlertLevel, typeof Clock> = { critical: AlertTriangle, serious: Clock, warning: Clock, good: TrendingUp };
const TONE: Record<AlertLevel, string> = {
  critical: 'bg-critical/20 text-critical-text',
  serious: 'bg-serious/20 text-serious',
  warning: 'bg-warning/20 text-warning',
  good: 'bg-good/20 text-good-text',
};

export function AlertsCard({ state, now, limit = 6 }: { state: State; now: number; limit?: number }) {
  const act = useAct();
  const list = getAlerts(state, now);
  return (
    <Card>
      <CardHead title="Diqqat talab" sub={`${list.length} ta`} />
      <div className="grid">
        {list.slice(0, limit).map((a, i) => {
          const Icon = ICON[a.level];
          const pl = a.platformId ? state.platforms.find((p) => p.id === a.platformId) : null;
          return (
            <div key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 border-b border-line px-1.5 py-[11px] last:border-b-0">
              <span className={cn('grid size-[22px] place-items-center rounded-[7px]', TONE[a.level])}><Icon size={13} /></span>
              <div>
                <b className="block text-[13.5px] font-semibold">{a.title}</b>
                <p className="mt-0.5 text-[12.5px] text-ink-2">{a.text}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.action === 'retry' && a.postId && <Button size="sm" onClick={() => act.mutate({ type: 'post.retry', payload: { postId: a.postId! } })}><RefreshCw size={14} />Qayta urinish</Button>}
                  {pl && <Button size="sm" onClick={() => act.mutate({ type: 'platform.update', payload: { id: pl.id, patch: { connected: true } } })}><Link2 size={14} />{pl.connected ? 'Tokenni yangilash' : 'Qayta ulash'}</Button>}
                  {a.action === 'plan' && <Button size="sm" onClick={() => openModal({ type: 'schedule', date: a.t + 12 * 3600e3 })}><Plus size={14} />Rejalashtirish</Button>}
                  {a.videoId && <Button size="sm" variant="ghost" onClick={() => openVideo(a.videoId!)}>Ochish</Button>}
                </div>
              </div>
            </div>
          );
        })}
        {!list.length && <Empty>Hammasi joyida ✓</Empty>}
      </div>
      {list.length > limit && (
        <p className="mt-2 text-[12.5px] text-muted">
          Yana {list.length - limit} ta — <Link to="/konveyer" className="underline">konveyerda ko‘ring</Link>
        </p>
      )}
    </Card>
  );
}
