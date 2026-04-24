import { INK, MUTED } from '../theme.js';
import { Card } from './Card.jsx';
import { Avatar } from './Avatar.jsx';

export function FeedCard({ game, byId, winnerOf, relativeDate, onClick }) {
  const p1 = byId[game.p1];
  const p2 = byId[game.p2];
  const winner = winnerOf(game);
  const isDraw = winner === null;
  const winP = winner ? byId[winner] : null;

  const nameStyle = (isWinner, isLoser) => ({
    fontSize: 13, fontWeight: 600, lineHeight: 1.25,
    color: isWinner ? byId[winner].color : isLoser ? 'rgba(26,22,18,0.42)' : INK,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    minWidth: 0,
  });

  return (
    <Card onClick={onClick} style={{ padding: '9px 12px 10px' }}>
      {/* ── Header: date + result chip ───────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 7,
      }}>
        <span style={{
          fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>{relativeDate(game.date)}</span>

        {isDraw ? (
          <span style={{
            background: 'rgba(26,22,18,0.07)', color: MUTED,
            fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
            padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
          }}>Ничья</span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: winP.color, color: '#fff',
            fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
            padding: '2px 4px 2px 8px', borderRadius: 20, textTransform: 'uppercase',
          }}>
            Победа
            <span style={{
              background: 'rgba(255,255,255,0.28)',
              fontSize: 8.5, padding: '1px 5px', borderRadius: 10, letterSpacing: 0,
            }}>{winP.short}</span>
          </span>
        )}
      </div>

      {/* ── Body: avatar | name · score · name | avatar ──── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Left player */}
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7,
          justifyContent: 'flex-end',
        }}>
          <div style={{ ...nameStyle(winner === p1.id, !isDraw && winner !== p1.id), textAlign: 'right' }}>
            {p1.name}
          </div>
          <Avatar player={p1} size={30} />
        </div>

        {/* Score */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 3,
          fontFamily: 'Archivo Black, system-ui', letterSpacing: -0.5,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{
            fontSize: 20, lineHeight: 1,
            color: winner === p1.id ? p1.color : isDraw ? INK : 'rgba(26,22,18,0.35)',
          }}>{game.s1}</span>
          <span style={{ fontSize: 14, color: MUTED, fontWeight: 600 }}>:</span>
          <span style={{
            fontSize: 20, lineHeight: 1,
            color: winner === p2.id ? p2.color : isDraw ? INK : 'rgba(26,22,18,0.35)',
          }}>{game.s2}</span>
        </div>

        {/* Right player */}
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <Avatar player={p2} size={30} />
          <div style={nameStyle(winner === p2.id, !isDraw && winner !== p2.id)}>
            {p2.name}
          </div>
        </div>
      </div>
    </Card>
  );
}
