import { MUTED, INK, CREAM2, eloColor } from '../theme.js';
import { Card } from '../components/Card.jsx';
import { Avatar } from '../components/Avatar.jsx';

const CREAM2_C = '#EFE7D8';

export function StatsScreen({ players, games, months, eloSeries, activity, go }) {
  const sorted = [...players].sort((a, b) => b.elo - a.elo);
  const maxActivity = Math.max(...activity, 1);

  return (
    <div style={{ padding: '52px 18px 110px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ fontFamily: 'Archivo Black', fontSize: 26, letterSpacing: -0.6, marginBottom: 20 }}>Статистика</div>

      {/* Elo standings */}
      <Card style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontFamily: 'Archivo Black', fontSize: 18, letterSpacing: -0.3 }}>Рейтинг</div>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Δ за месяц</div>
        </div>
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>Текущие позиции и изменение</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((p, idx) => {
            const series = eloSeries[p.id] || [];
            const delta = series.length >= 2 ? series[series.length - 1] - series[series.length - 2] : 0;
            const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(2);
            const deltaColor = delta > 0.05 ? '#2E9B5E' : (delta < -0.05 ? '#D14A3A' : MUTED);
            const widthPct = (p.elo / 10) * 100;
            return (
              <div key={p.id}
                onClick={() => go && go('profile', { playerId: p.id })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: go ? 'pointer' : 'default',
                  margin: '0 -6px', padding: '4px 6px', borderRadius: 10,
                }}
                onMouseDown={e => { if (go) e.currentTarget.style.background = 'rgba(26,22,18,0.04)'; }}
                onMouseUp={e => { e.currentTarget.style.background = 'transparent'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                onTouchStart={e => { if (go) e.currentTarget.style.background = 'rgba(26,22,18,0.04)'; }}
                onTouchEnd={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontFamily: 'Archivo Black', fontSize: 13, color: MUTED, width: 16, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</div>
                <Avatar player={p} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{p.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: deltaColor, fontVariantNumeric: 'tabular-nums', letterSpacing: 0.2 }}>{deltaStr}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: CREAM2_C, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${widthPct}%`, height: '100%', background: p.color, borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{
                  fontFamily: 'Archivo Black', fontSize: 16, color: INK,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3, width: 40, textAlign: 'right'
                }}>{p.elo.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Activity bars */}
      <Card style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 18, letterSpacing: -0.3 }}>Активность</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>Сыграно партий в месяц</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130, paddingBottom: 20, position: 'relative' }}>
          {activity.map((v, i) => {
            const h = (v / maxActivity) * 110;
            const isMax = v === maxActivity;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
                <div style={{ fontFamily: 'Archivo Black', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: isMax ? '#E8542A' : INK }}>{v}</div>
                <div style={{ width: '100%', height: h, borderRadius: '8px 8px 4px 4px', background: isMax ? '#E8542A' : '#E5A83A' }} />
                <div style={{ position: 'absolute', bottom: -18, fontSize: 10.5, color: MUTED, fontWeight: 600 }}>{months[i]}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Total games counter */}
      <Card style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Всего матчей</div>
          <div style={{ fontFamily: 'Archivo Black', fontSize: 32, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>{games.length}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Игроков</div>
          <div style={{ fontFamily: 'Archivo Black', fontSize: 32, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>{players.length}</div>
        </div>
      </Card>
    </div>
  );
}
