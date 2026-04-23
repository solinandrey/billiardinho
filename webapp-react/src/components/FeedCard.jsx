import { INK, MUTED } from '../theme.js';
import { Card } from './Card.jsx';
import { Avatar } from './Avatar.jsx';

export function FeedCard({ game, byId, winnerOf, relativeDate, onClick }) {
  const p1 = byId[game.p1];
  const p2 = byId[game.p2];
  const winner = winnerOf(game);

  return (
    <Card onClick={onClick} style={{ padding: '10px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* left player */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: winner === p1.id ? p1.color : INK,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{p1.name}</div>
          <Avatar player={p1} size={28} />
        </div>

        {/* score */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'Archivo Black, system-ui', fontSize: 20, lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: winner === p1.id ? p1.color : (winner ? 'rgba(26,22,18,0.35)' : INK),
          }}>{game.s1}</span>
          <span style={{ fontSize: 14, color: MUTED, fontWeight: 600 }}>:</span>
          <span style={{
            fontFamily: 'Archivo Black, system-ui', fontSize: 20, lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: winner === p2.id ? p2.color : (winner ? 'rgba(26,22,18,0.35)' : INK),
          }}>{game.s2}</span>
        </div>

        {/* right player */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <Avatar player={p2} size={28} />
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: winner === p2.id ? p2.color : INK,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{p2.name}</div>
        </div>
      </div>

      <div style={{
        marginTop: 6, fontSize: 10, color: MUTED, fontWeight: 600, letterSpacing: 0.4,
        textTransform: 'uppercase', textAlign: 'center',
      }}>
        {relativeDate(game.date)}
      </div>
    </Card>
  );
}
