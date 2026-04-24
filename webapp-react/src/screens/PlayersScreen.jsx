import { MUTED, INK, eloColor } from '../theme.js';
import { Card } from '../components/Card.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Icon } from '../components/Icon.jsx';

const BALL_COLORS = ['#F2C844','#2F63C9','#D14A3A','#7E3FAF','#E38A2B','#2E7A4E','#8B2E2E','#1A1612'];

export function PlayersScreen({ players, games, go }) {
  const sorted = [...players].sort((a, b) => b.elo - a.elo);
  const CREAM2 = '#EFE7D8';

  return (
    <div style={{ padding: '52px 18px 110px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Таблица лидеров</div>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 26, letterSpacing: -0.6, marginTop: 2 }}>Игроки</div>
      </div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
        {games.length} партий записано
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map((p, i) => {
          const ball = BALL_COLORS[Math.min(i, BALL_COLORS.length - 1)];
          const striped = i >= 8;
          return (
            <Card key={p.id} onClick={() => go('profile', { playerId: p.id })}
              style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Pool ball rank */}
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: striped
                  ? `conic-gradient(from 45deg, #fff 0deg 60deg, ${ball} 60deg 120deg, #fff 120deg 240deg, ${ball} 240deg 300deg, #fff 300deg 360deg)`
                  : ball,
                position: 'relative', flexShrink: 0,
                boxShadow: 'inset -3px -3px 6px rgba(0,0,0,0.25), inset 2px 2px 4px rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 15, height: 15, borderRadius: '50%', background: '#FFFBF2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Archivo Black', fontSize: 10, color: INK,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3,
                }}>{i + 1}</div>
              </div>

              <Avatar player={p} size={44} />

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: INK, letterSpacing: -0.2 }}>{p.name}</span>
                <span style={{ fontSize: 12.5, color: MUTED, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  {p.wins}/{p.games} · {p.games ? Math.round(p.wins * 100 / p.games) : 0}%
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'Archivo Black', fontSize: 20, letterSpacing: -0.3,
                  color: eloColor(p.elo), fontVariantNumeric: 'tabular-nums',
                }}>{p.elo.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: -2 }}>рейтинг</div>
              </div>
              {Icon.chev(MUTED)}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
