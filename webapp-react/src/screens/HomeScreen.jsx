import { MUTED, INK } from '../theme.js';
import { Card } from '../components/Card.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { FeedCard } from '../components/FeedCard.jsx';
import { Icon } from '../components/Icon.jsx';

const DAYS_RU = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const MONTHS_RU = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

function todayLabel() {
  const d = new Date();
  return `${DAYS_RU[d.getDay()]} · ${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
}

export function HomeScreen({ me, players, games, byId, winnerOf, relativeDate, go }) {
  const winPct = me.games ? Math.round(me.wins * 100 / me.games) : 0;

  return (
    <div style={{ padding: '52px 18px 110px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {todayLabel()}
        </div>
        <div style={{ fontFamily: 'Archivo Black, system-ui', fontSize: 22, letterSpacing: -0.5, marginTop: 2 }}>
          Привет, {me.name}
        </div>
      </div>

      {/* My dashboard */}
      <Card
        onClick={() => go('profile', { playerId: me.id })}
        bg={me.color}
        style={{ padding: '16px 18px', color: '#fff', border: 'none', position: 'relative', overflow: 'hidden' }}
      >
        <div style={{
          position: 'absolute', right: -40, top: -32, width: 130, height: 130, borderRadius: '50%',
          background: 'rgba(255,255,255,0.09)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <Avatar player={me} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, letterSpacing: 0.4, textTransform: 'uppercase' }}>Мой рейтинг</div>
            <div style={{ fontFamily: 'Archivo Black', fontSize: 34, lineHeight: 1, letterSpacing: -0.8, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {me.elo.toFixed(1)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              {[
                { val: me.wins,  label: 'побед'  },
                { val: me.games, label: 'игр'    },
                { val: winPct + '%', label: 'винрейт' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: i ? 10 : 0 }}>
                  {i > 0 && <div style={{ width: 3, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.55)', marginRight: 10 }} />}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{s.val}</span>
                    <span style={{ fontSize: 11, opacity: 0.78, fontWeight: 600 }}>{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {Icon.chev('rgba(255,255,255,0.75)')}
        </div>
      </Card>

      {/* Feed */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '22px 4px 10px' }}>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 16, letterSpacing: -0.2 }}>Последние партии</div>
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{games.length} всего</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {games.slice(0, 8).map(g => (
          <FeedCard
            key={g.id} game={g} byId={byId}
            winnerOf={winnerOf} relativeDate={relativeDate}
            onClick={() => go('game', { gameId: g.id })}
          />
        ))}
      </div>
    </div>
  );
}
