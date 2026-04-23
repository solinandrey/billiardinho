import { useState } from 'react';
import { CREAM, MUTED, INK, LINE } from '../theme.js';
import { Avatar } from '../components/Avatar.jsx';
import { Icon } from '../components/Icon.jsx';

const MONTHS_RU = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

function ScoreBox({ player, val, setVal }) {
  return (
    <div style={{
      flex: 1, background: '#FFFBF2', border: `2px solid ${player.color}`,
      borderRadius: 22, padding: '16px 8px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{
        fontFamily: 'Archivo Black', fontSize: 64, lineHeight: 1,
        color: player.color, letterSpacing: -3, fontVariantNumeric: 'tabular-nums',
      }}>{val}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={() => setVal(Math.max(0, val - 1))} style={{
          width: 30, height: 30, borderRadius: 15,
          background: '#EFE7D8', border: 'none', cursor: 'pointer',
          fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1,
        }}>−</button>
        <button onClick={() => setVal(Math.min(15, val + 1))} style={{
          width: 30, height: 30, borderRadius: 15,
          background: '#EFE7D8', border: 'none', cursor: 'pointer',
          fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1,
        }}>+</button>
      </div>
    </div>
  );
}

export function AddGameSheet({ me, players, onClose, onSaved }) {
  const [s1, setS1] = useState(9);
  const [s2, setS2] = useState(6);
  const [oppId, setOppId] = useState(players.find(p => p.id !== me.id)?.id || null);
  const [oppQuery, setOppQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const dateLabel = `Сегодня · ${today.getDate()} ${MONTHS_RU[today.getMonth()]}`;

  const allOpponents = players.filter(p => p.id !== me.id);
  const q = oppQuery.trim().toLowerCase();
  const filteredOpps = q ? allOpponents.filter(p => p.name.toLowerCase().includes(q)) : allOpponents;
  const opp = players.find(p => p.id === oppId) || allOpponents[0];

  const handleSave = async () => {
    if (!opp || saving) return;
    setSaving(true);
    try {
      await onSaved({ opponentId: opp.id, scoreMe: s1, scoreOpp: s2 });
      onClose();
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(10,8,5,0.35)', backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: CREAM, borderRadius: '30px 30px 0 0',
        padding: '14px 20px 34px', position: 'relative',
        maxHeight: '88%', overflowY: 'auto',
        boxShadow: '0 -20px 50px rgba(0,0,0,0.2)',
      }}>
        <div style={{ width: 44, height: 4, borderRadius: 2, background: 'rgba(26,22,18,0.2)', margin: '0 auto 14px' }} />

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Новая партия</div>
            <div style={{ fontFamily: 'Archivo Black', fontSize: 26, letterSpacing: -0.6, marginTop: 2 }}>Запиши счёт</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 16, border: 'none', background: '#FFFBF2',
            color: INK, fontSize: 18, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* Score inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <ScoreBox player={me} val={s1} setVal={setS1} />
          <div style={{ fontFamily: 'Archivo Black', fontSize: 48, color: MUTED, marginTop: -22 }}>:</div>
          {opp && <ScoreBox player={opp} val={s2} setVal={setS2} />}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: me.color }}>{me.name}</div>
          <div style={{ width: 28 }} />
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: opp?.color }}>{opp?.name}</div>
        </div>

        {/* Opponent picker */}
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Соперник</div>
        <div style={{
          background: '#FFFBF2', border: `1px solid ${LINE}`, borderRadius: 14,
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
        }}>
          {Icon.search(MUTED)}
          <input
            value={oppQuery}
            onChange={e => setOppQuery(e.target.value)}
            placeholder="Поиск по имени"
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 14, color: INK, fontFamily: 'Inter, system-ui, sans-serif',
            }}
          />
          {oppQuery && (
            <button onClick={() => setOppQuery('')} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: MUTED, fontSize: 16, padding: 2,
            }}>×</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 20 }}>
          {filteredOpps.length === 0 && (
            <div style={{ fontSize: 12.5, color: MUTED, padding: '8px 4px' }}>Никого не найдено</div>
          )}
          {filteredOpps.map(p => {
            const sel = p.id === oppId;
            return (
              <button key={p.id} onClick={() => setOppId(p.id)} style={{
                flexShrink: 0, width: 76, padding: '10px 6px',
                background: sel ? p.color : '#FFFBF2',
                border: sel ? 'none' : `1px solid ${LINE}`,
                borderRadius: 16, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                color: sel ? '#fff' : INK,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 19, background: p.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Archivo Black', color: '#fff', fontSize: 15,
                  border: sel ? '2.5px solid rgba(255,255,255,0.5)' : 'none',
                }}>{p.short}</div>
                <span style={{ fontSize: 11.5, fontWeight: 700 }}>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Date */}
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Дата</div>
        <div style={{
          background: '#FFFBF2', border: `1px solid ${LINE}`, borderRadius: 14,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22,
        }}>
          {Icon.calendar(INK)}
          <span style={{ fontSize: 15, fontWeight: 600 }}>{dateLabel}</span>
          <div style={{ flex: 1 }} />
          {Icon.chev(MUTED)}
        </div>

        {/* CTA */}
        <button onClick={handleSave} disabled={!opp || saving} style={{
          width: '100%', padding: '16px 20px', borderRadius: 18,
          background: opp ? me.color : 'rgba(26,22,18,0.25)',
          color: '#fff', border: 'none', cursor: opp ? 'pointer' : 'default',
          fontFamily: 'Archivo Black', fontSize: 17, letterSpacing: 0.3,
          boxShadow: opp ? `0 6px 16px ${me.color}44` : 'none',
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ ПАРТИЮ'}
        </button>
      </div>
    </div>
  );
}
