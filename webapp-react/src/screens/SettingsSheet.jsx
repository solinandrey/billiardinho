import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MUTED, INK, LINE } from '../theme.js';
import { haptic } from '../haptic.js';

const PALETTE = ['#E8542A','#4F7FE8','#2ECC7A','#A855F7','#E5A83A','#E3457F','#2BB8CC','#6B8E23'];

export function SettingsSheet({ player, onClose, onSaved }) {
  const [name, setName] = useState(player.name);
  const [short, setShort] = useState(player.short);
  const [color, setColor] = useState(player.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const dirty = name.trim() !== player.name || short.trim() !== player.short || color !== player.color;
  const canSave = dirty && !saving && name.trim().length > 0 && short.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    haptic.medium();
    try {
      await (onSaved && onSaved({ name: name.trim(), short: short.trim().slice(0, 2), color }));
      haptic.success();
      onClose();
    } catch (e) {
      haptic.error();
      setError(e?.message || String(e));
      setSaving(false);
    }
  };

  return createPortal((
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,8,5,0.42)', backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} className="sheet-enter" style={{
        background: '#FFFBF2', color: INK,
        borderRadius: '26px 26px 0 0',
        padding: '14px 20px 26px',
        boxShadow: '0 -20px 50px rgba(0,0,0,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: MUTED }}>Настройки</div>
            <div style={{ fontFamily: 'Archivo Black', fontSize: 20, letterSpacing: -0.3, marginTop: 2 }}>Профиль</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 27,
              background: color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Archivo Black', fontSize: 22, letterSpacing: -0.6,
              transition: 'background 160ms ease',
            }}>{short || '—'}</div>
            <button onClick={onClose} aria-label="Закрыть" style={{
              width: 32, height: 32, borderRadius: 16, border: `1px solid ${LINE}`,
              background: '#FFFBF2', color: INK, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, lineHeight: 1, padding: 0,
            }}>×</button>
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>Имя</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" style={{
            width: '100%', padding: '12px 14px', borderRadius: 12,
            border: `1px solid ${LINE}`, background: '#fff', boxSizing: 'border-box',
            fontFamily: 'Inter, system-ui, sans-serif', fontSize: 15, fontWeight: 600, color: INK,
            outline: 'none',
          }} />
        </div>

        {/* Short */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>
            Инициалы <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0 }}>· 1–2 символа</span>
          </div>
          <input value={short} onChange={e => setShort(e.target.value.slice(0, 2))} maxLength={2} style={{
            width: 80, padding: '10px 12px', borderRadius: 12,
            border: `1px solid ${LINE}`, background: '#fff', textAlign: 'center',
            fontFamily: 'Archivo Black', fontSize: 18, letterSpacing: -0.3, color: INK,
            outline: 'none',
          }} />
        </div>

        {/* Color */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>Цвет</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PALETTE.map(c => (
              <button key={c} onClick={() => { haptic.selection(); setColor(c); }} aria-label={c} style={{
                width: 34, height: 34, borderRadius: 17, border: 'none',
                background: c, cursor: 'pointer', padding: 0,
                boxShadow: color === c ? `0 0 0 3px #FFFBF2, 0 0 0 5px ${c}` : 'none',
                transition: 'box-shadow 140ms ease',
              }} />
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: 12, padding: '10px 12px', borderRadius: 10,
            background: 'rgba(232,84,42,0.12)', color: '#B33A1A',
            fontSize: 12.5, fontWeight: 600, wordBreak: 'break-word',
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{
            flex: 1, padding: '13px 0', borderRadius: 14,
            background: 'transparent', color: INK, border: `1px solid ${LINE}`,
            fontFamily: 'Archivo Black', fontSize: 13, letterSpacing: 0.4,
            cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1,
          }}>ОТМЕНА</button>
          <button onClick={save} disabled={!canSave} style={{
            flex: 2, padding: '13px 0', borderRadius: 14,
            background: canSave ? INK : 'rgba(26,22,18,0.25)',
            color: canSave ? '#F5EFE4' : 'rgba(255,251,242,0.75)',
            border: 'none',
            fontFamily: 'Archivo Black', fontSize: 13, letterSpacing: 0.4,
            cursor: canSave ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {saving && (
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid rgba(255,251,242,0.4)',
                borderTopColor: '#F5EFE4',
                animation: 'spin 0.8s linear infinite',
                display: 'inline-block',
              }} />
            )}
            {saving ? 'СОХРАНЯЮ…' : 'СОХРАНИТЬ'}
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  ), document.body);
}
