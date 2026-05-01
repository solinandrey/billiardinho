import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CREAM, MUTED, INK, LINE } from '../theme.js';
import { Icon } from '../components/Icon.jsx';
import { haptic } from '../haptic.js';

const MONTHS_RU = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatDateLabel(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const today = todayISO();
  if (iso === today) return `Сегодня · ${d} ${MONTHS_RU[m - 1]}`;
  // yesterday?
  const t = new Date();
  t.setDate(t.getDate() - 1);
  const ymd = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  if (iso === ymd) return `Вчера · ${d} ${MONTHS_RU[m - 1]}`;
  return `${d} ${MONTHS_RU[m - 1]} ${y}`;
}

function ScoreBox({ player, val, setVal }) {
  return (
    <div style={{
      flex: 1, background: '#FFFBF2', border: `2px solid ${player.color}`,
      borderRadius: 18, padding: '8px 6px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={val}
        onFocus={e => e.target.select()}
        onChange={e => {
          const raw = e.target.value.replace(/[^0-9]/g, '');
          if (raw === '') { setVal(0); return; }
          const n = parseInt(raw, 10);
          if (!Number.isNaN(n)) setVal(Math.min(99, n));
        }}
        style={{
          width: '100%', border: 'none', outline: 'none', background: 'transparent',
          textAlign: 'center', padding: 0,
          fontFamily: 'Archivo Black', fontSize: 46, lineHeight: 1,
          color: player.color, letterSpacing: -2, fontVariantNumeric: 'tabular-nums',
          caretColor: player.color,
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={() => { haptic.selection(); setVal(Math.max(0, val - 1)); }} style={{
          width: 26, height: 26, borderRadius: 13,
          background: '#EFE7D8', border: 'none', cursor: 'pointer',
          fontSize: 16, fontWeight: 700, color: INK, lineHeight: 1,
        }}>−</button>
        <button onClick={() => { haptic.selection(); setVal(Math.min(99, val + 1)); }} style={{
          width: 26, height: 26, borderRadius: 13,
          background: '#EFE7D8', border: 'none', cursor: 'pointer',
          fontSize: 16, fontWeight: 700, color: INK, lineHeight: 1,
        }}>+</button>
      </div>
    </div>
  );
}

export function AddGameSheet({ me, players, onClose, onSaved }) {
  const [s1, setS1] = useState(0);
  const [s2, setS2] = useState(0);
  const [oppId, setOppId] = useState(players.find(p => p.id !== me.id)?.id || null);
  const [oppQuery, setOppQuery] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const allOpponents = players.filter(p => p.id !== me.id);
  const q = oppQuery.trim().toLowerCase();
  const filteredOpps = q ? allOpponents.filter(p => p.name.toLowerCase().includes(q)) : allOpponents;
  const opp = players.find(p => p.id === oppId) || allOpponents[0];

  const handleSave = async () => {
    if (!opp || saving) return;
    setSaving(true);
    haptic.medium();
    try {
      // Store at noon UTC of the selected date — avoids TZ rollover to the previous day
      const playedAt = `${date}T12:00:00.000Z`;
      await onSaved({ opponentId: opp.id, scoreMe: s1, scoreOpp: s2, playedAt, note: note.trim() || null });
      haptic.success();
      onClose();
    } catch (e) {
      console.error(e);
      haptic.error();
      setSaving(false);
    }
  };

  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,8,5,0.35)', backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="sheet-enter" style={{
        background: CREAM, borderRadius: '30px 30px 0 0',
        padding: '12px 18px 20px', position: 'relative',
        maxHeight: '92%', overflowY: 'auto',
        boxShadow: '0 -20px 50px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Новая партия</div>
            <div style={{ fontFamily: 'Archivo Black', fontSize: 22, letterSpacing: -0.5, marginTop: 1 }}>Запиши счёт</div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 15, border: 'none', background: '#FFFBF2',
            color: INK, fontSize: 17, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* Score inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <ScoreBox player={me} val={s1} setVal={setS1} />
          <div style={{ fontFamily: 'Archivo Black', fontSize: 34, color: MUTED, marginTop: -16 }}>:</div>
          {opp && <ScoreBox player={opp} val={s2} setVal={setS2} />}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: me.color }}>{me.name}</div>
          <div style={{ width: 24 }} />
          <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: opp?.color }}>{opp?.name}</div>
        </div>

        {/* Opponent picker */}
        <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Соперник</div>
        <div style={{
          background: '#FFFBF2', border: `1px solid ${LINE}`, borderRadius: 12,
          padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        }}>
          {Icon.search(MUTED)}
          <input
            value={oppQuery}
            onChange={e => setOppQuery(e.target.value)}
            placeholder="Поиск по имени"
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 13.5, color: INK, fontFamily: 'Inter, system-ui, sans-serif',
            }}
          />
          {oppQuery && (
            <button onClick={() => setOppQuery('')} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: MUTED, fontSize: 15, padding: 2,
            }}>×</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
          {filteredOpps.length === 0 && (
            <div style={{ fontSize: 12, color: MUTED, padding: '6px 4px' }}>Никого не найдено</div>
          )}
          {filteredOpps.map(p => {
            const sel = p.id === oppId;
            return (
              <button key={p.id} onClick={() => setOppId(p.id)} style={{
                flexShrink: 0, width: 64, padding: '6px 4px',
                background: sel ? p.color : '#FFFBF2',
                border: sel ? 'none' : `1px solid ${LINE}`,
                borderRadius: 14, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                color: sel ? '#fff' : INK,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 16, background: p.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Archivo Black', color: '#fff', fontSize: 13,
                  border: sel ? '2px solid rgba(255,255,255,0.5)' : 'none',
                }}>{p.short}</div>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Date */}
        <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Дата</div>
        <label style={{
          background: '#FFFBF2', border: `1px solid ${LINE}`, borderRadius: 12,
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          position: 'relative', cursor: 'pointer',
        }}>
          {Icon.calendar(INK)}
          <span style={{ fontSize: 14, fontWeight: 600 }}>{formatDateLabel(date)}</span>
          <div style={{ flex: 1 }} />
          {Icon.chev(MUTED)}
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={e => e.target.value && setDate(e.target.value)}
            style={{
              position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
              border: 'none', background: 'transparent', fontSize: 16,
              WebkitAppearance: 'none', appearance: 'none',
            }}
          />
        </label>

        {/* Note (optional) */}
        <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
          Заметка <span style={{ opacity: 0.55, textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>· необязательно</span>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 500))}
          placeholder="Где играли, как, что-нибудь смешное…"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'none',
            background: '#FFFBF2', border: `1px solid ${LINE}`, borderRadius: 12,
            padding: '10px 12px', marginBottom: 14, outline: 'none',
            fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13.5, color: INK,
            lineHeight: 1.4,
          }}
        />

        {/* CTA */}
        <button onClick={handleSave} disabled={!opp || saving} style={{
          width: '100%', padding: '13px 20px', borderRadius: 16,
          background: opp ? me.color : 'rgba(26,22,18,0.25)',
          color: '#fff', border: 'none', cursor: opp ? 'pointer' : 'default',
          fontFamily: 'Archivo Black', fontSize: 15.5, letterSpacing: 0.3,
          boxShadow: opp ? `0 6px 16px ${me.color}44` : 'none',
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ ПАРТИЮ'}
        </button>
      </div>
    </div>
  ), document.body);
}
