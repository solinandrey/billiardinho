import { useState } from 'react';
import { createPortal } from 'react-dom';
import { INK, MUTED, LINE } from '../theme.js';
import { Icon } from '../components/Icon.jsx';
import { haptic } from '../haptic.js';

const MONTHS_RU = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_RU[m - 1]} ${y}`;
}

function EditScoreCol({ player, val, setVal }) {
  const btnStyle = {
    width: 28, height: 28, borderRadius: 14,
    background: 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer',
    fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1,
  };
  return (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.14)', border: '1.5px solid rgba(255,255,255,0.38)',
      borderRadius: 18, padding: '10px 6px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{
        fontFamily: 'Archivo Black', fontSize: 52, lineHeight: 1,
        color: '#fff', letterSpacing: -2, fontVariantNumeric: 'tabular-nums',
      }}>{val}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => { haptic.selection(); setVal(Math.max(0, val - 1)); }} style={btnStyle}>−</button>
        <button onClick={() => { haptic.selection(); setVal(Math.min(15, val + 1)); }} style={btnStyle}>+</button>
      </div>
    </div>
  );
}

function EloDelta({ before, after }) {
  if (before == null || after == null) {
    return <div style={{ height: 14, marginTop: 3 }} />;
  }
  const delta = Math.round((after - before) * 100) / 100;
  const up = delta > 0;
  const dn = delta < 0;
  const sign = up ? '+' : dn ? '−' : '±';
  const abs = Math.abs(delta).toFixed(2);
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 0.2, marginTop: 4,
      color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{ opacity: 0.75 }}>{after.toFixed(2)}</span>
      <span style={{
        marginLeft: 5, padding: '1px 6px', borderRadius: 8,
        background: up ? 'rgba(255,255,255,0.22)' : dn ? 'rgba(0,0,0,0.18)' : 'transparent',
        color: '#fff',
      }}>{sign}{abs}</span>
    </div>
  );
}

function PlayerTag({ p, isWinner, onClick, eloBefore, eloAfter }) {
  return (
    <div onClick={onClick} style={{
      textAlign: 'center', cursor: onClick ? 'pointer' : 'default',
      userSelect: 'none', width: '100%', maxWidth: 140,
    }}>
      {/* Avatar with crown */}
      <div style={{ position: 'relative', width: 50, height: 50, margin: '0 auto' }}>
        {isWinner && (
          <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)' }}>
            {Icon.crown('#fff')}
          </div>
        )}
        <div style={{
          width: 50, height: 50, borderRadius: 25,
          background: '#fff', color: p.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Archivo Black', fontSize: 20,
          boxShadow: isWinner ? '0 0 0 3px rgba(255,255,255,0.5)' : 'none',
        }}>{p.short}</div>
      </div>

      {/* Winner badge — reserved height so both sides stay equal */}
      <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
        {isWinner && (
          <span style={{
            background: 'rgba(255,255,255,0.28)', color: '#fff',
            fontSize: 9, fontWeight: 800, letterSpacing: 0.7,
            padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
          }}>Победа</span>
        )}
      </div>

      {/* Name — wraps up to 2 lines */}
      <div style={{
        fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginTop: 2,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', wordBreak: 'break-word',
      }}>
        {p.name}{onClick ? <span style={{ opacity: 0.6 }}> ›</span> : null}
      </div>

      {/* Elo delta */}
      <EloDelta before={eloBefore} after={eloAfter} />
    </div>
  );
}

export function GameDetailSheet({ game, byId, meId, winnerOf, onClose, onSaved, onDelete, go }) {
  const p1 = byId[game.p1];
  const p2 = byId[game.p2];
  const [editing, setEditing] = useState(false);
  const [s1, setS1] = useState(game.s1);
  const [s2, setS2] = useState(game.s2);
  const [note, setNote] = useState(game.note || '');
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);

  const curS1 = editing ? s1 : game.s1;
  const curS2 = editing ? s2 : game.s2;
  const pseudoWinner = curS1 > curS2 ? p1.id : curS1 < curS2 ? p2.id : null;
  const winner = editing ? pseudoWinner : winnerOf(game);
  const bg = winner ? byId[winner].color : '#3A342B';

  const isMyGame = game.p1 === meId || game.p2 === meId;
  const myResult = !winner ? 'Ничья' : winner === meId ? 'Победа' : 'Поражение';
  const resultLabel = editing ? 'Редактирование' : (isMyGame ? myResult : (winner ? 'Результат' : 'Ничья'));

  const saveEdit = async () => {
    if (saving) return;
    setSaving(true);
    haptic.medium();
    try {
      await onSaved(game.id, { s1, s2, note: note.trim() || null });
      haptic.success();
      setEditing(false);
    } catch (e) {
      console.error(e);
      haptic.error();
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    haptic.heavy();
    await onDelete(game.id);
    onClose();
  };

  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,8,5,0.42)', backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={(editing || confirmDel) ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} className="sheet-enter" style={{
        background: bg, color: '#fff',
        borderRadius: '30px 30px 0 0',
        padding: '14px 20px 26px', position: 'relative', overflow: 'hidden',
        boxShadow: '0 -20px 50px rgba(0,0,0,0.28)',
        transition: 'background 260ms ease',
      }}>
        {/* decorative rings */}
        <svg style={{ position: 'absolute', right: -30, bottom: -30, opacity: 0.14, pointerEvents: 'none' }} width="200" height="200" viewBox="0 0 200 200">
          <g stroke="#fff" strokeWidth="1" fill="none">
            {[40, 80, 120, 160].map(r => <circle key={r} cx="100" cy="100" r={r} />)}
          </g>
        </svg>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, position: 'relative' }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.75 }}>Партия</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 1 }}>{formatDate(game.date)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              padding: '5px 12px', borderRadius: 999,
              background: 'rgba(255,255,255,0.22)', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
            }}>{resultLabel}</div>
            {!editing && (
              <button onClick={() => { haptic.light(); setS1(game.s1); setS2(game.s2); setNote(game.note || ''); setEditing(true); setConfirmDel(false); }} aria-label="Редактировать" style={{
                width: 34, height: 34, borderRadius: 17,
                background: 'rgba(255,255,255,0.22)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}>
                {Icon.pencil('#fff')}
              </button>
            )}
            {!editing && (
              <button onClick={() => { haptic.warning(); setConfirmDel(true); }} aria-label="Удалить" style={{
                width: 34, height: 34, borderRadius: 17,
                background: 'rgba(255,255,255,0.22)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}>
                {Icon.trash('#fff')}
              </button>
            )}
            {!editing && (
              <button onClick={() => { haptic.light(); onClose(); }} aria-label="Закрыть" style={{
                width: 34, height: 34, borderRadius: 17,
                background: 'rgba(255,255,255,0.22)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                color: '#fff', fontSize: 19, lineHeight: 1, fontWeight: 500,
              }}>×</button>
            )}
          </div>
        </div>

        <div style={{ position: 'relative', textAlign: 'center' }}>
          {!editing ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 18 }}>
              <span style={{
                fontFamily: 'Archivo Black', fontSize: winner === p1.id ? 92 : 72,
                lineHeight: 0.95, letterSpacing: -4, fontVariantNumeric: 'tabular-nums',
                opacity: winner === p2.id ? 0.5 : 1,
              }}>{game.s1}</span>
              <span style={{ fontSize: 46, opacity: 0.5, fontWeight: 900, margin: '0 6px' }}>:</span>
              <span style={{
                fontFamily: 'Archivo Black', fontSize: winner === p2.id ? 92 : 72,
                lineHeight: 0.95, letterSpacing: -4, fontVariantNumeric: 'tabular-nums',
                opacity: winner === p1.id ? 0.5 : 1,
              }}>{game.s2}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, marginBottom: 16 }}>
              <EditScoreCol player={p1} val={s1} setVal={setS1} />
              <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'Archivo Black', fontSize: 40, opacity: 0.6 }}>:</div>
              <EditScoreCol player={p2} val={s2} setVal={setS2} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <PlayerTag p={p1} isWinner={winner === p1.id}
                eloBefore={editing ? null : game.r1_before} eloAfter={editing ? null : game.r1_after}
                onClick={editing ? null : () => { onClose(); go && go('profile', { playerId: p1.id }); }} />
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <PlayerTag p={p2} isWinner={winner === p2.id}
                eloBefore={editing ? null : game.r2_before} eloAfter={editing ? null : game.r2_after}
                onClick={editing ? null : () => { onClose(); go && go('profile', { playerId: p2.id }); }} />
            </div>
          </div>

          {/* Note: read-only view */}
          {!editing && game.note && (
            <div style={{
              marginTop: 18, padding: '11px 14px',
              background: 'rgba(255,255,255,0.16)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 14, textAlign: 'left',
              fontSize: 13, lineHeight: 1.4, color: '#fff', fontWeight: 500,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              <div style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
                opacity: 0.75, marginBottom: 4,
              }}>Заметка</div>
              {game.note}
            </div>
          )}

          {/* Note: edit mode */}
          {editing && (
            <div style={{ marginTop: 18, textAlign: 'left' }}>
              <div style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.78)', marginBottom: 6,
              }}>Заметка</div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value.slice(0, 500))}
                placeholder="Где играли, как, что-нибудь смешное…"
                rows={2}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'none',
                  background: 'rgba(255,255,255,0.16)',
                  border: '1px solid rgba(255,255,255,0.32)',
                  borderRadius: 12, padding: '10px 12px', outline: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13.5,
                  color: '#fff', lineHeight: 1.4,
                }}
              />
            </div>
          )}

          {editing && (
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => { setEditing(false); setNote(game.note || ''); }} style={{
                flex: 1, padding: '12px 0', borderRadius: 14,
                background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none',
                fontFamily: 'Archivo Black', fontSize: 13, letterSpacing: 0.4, cursor: 'pointer',
              }}>ОТМЕНА</button>
              <button onClick={saveEdit} disabled={saving} style={{
                flex: 2, padding: '12px 0', borderRadius: 14,
                background: '#fff', color: bg, border: 'none',
                fontFamily: 'Archivo Black', fontSize: 13, letterSpacing: 0.4, cursor: 'pointer',
                opacity: saving ? 0.7 : 1,
              }}>{saving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}</button>
            </div>
          )}
        </div>

        {confirmDel && (
          <div onClick={() => setConfirmDel(false)} style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)',
            borderRadius: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#FFFBF2', color: INK, borderRadius: 18,
              padding: '18px 18px 16px', width: '100%', maxWidth: 300,
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            }}>
              <div style={{ fontFamily: 'Archivo Black', fontSize: 16, letterSpacing: -0.3, marginBottom: 4 }}>
                Удалить партию?
              </div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 1.35 }}>
                Счёт {game.s1}:{game.s2} между {p1.name} и {p2.name} будет удалён безвозвратно.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDel(false)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: 'transparent', color: INK, border: `1px solid ${LINE}`,
                  fontFamily: 'Archivo Black', fontSize: 12, letterSpacing: 0.4, cursor: 'pointer',
                }}>ОТМЕНА</button>
                <button onClick={doDelete} style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: '#E8542A', color: '#fff', border: 'none',
                  fontFamily: 'Archivo Black', fontSize: 12, letterSpacing: 0.4, cursor: 'pointer',
                }}>УДАЛИТЬ</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  ), document.body);
}
