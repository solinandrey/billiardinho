import { Icon } from './Icon.jsx';
import { haptic } from '../haptic.js';

const items = [
  { id: 'home',    label: 'Главная',    icon: Icon.home },
  { id: 'players', label: 'Игроки',     icon: Icon.trophy },
  { id: 'add',     label: 'Добавить',   icon: null, center: true },
  { id: 'stats',   label: 'Статистика', icon: Icon.chart },
  { id: 'profile', label: 'Профиль',    icon: Icon.user },
];

const BAR_H = 62;
const FAB_SIZE = 48;
const GAP = 4;
const CUTOUT_R = FAB_SIZE / 2 + GAP;
const POP = 10;

function NavItem({ item, active, onClick }) {
  const c = active ? '#FFFBF2' : 'rgba(255,251,242,0.72)';
  return (
    <button onClick={onClick} aria-label={item.label} style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '4px 0', position: 'relative',
    }}>
      {item.icon(c, active)}
      <div style={{
        width: active ? 16 : 0, height: 2, borderRadius: 1,
        background: '#FFFBF2', transition: 'width 160ms ease',
      }} />
    </button>
  );
}

export function BottomNav({ tab, setTab, openAdd }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0,
      paddingBottom: 'env(safe-area-inset-bottom, 18px)',
      paddingLeft: 16, paddingRight: 16, paddingTop: 14,
      display: 'flex', justifyContent: 'center', zIndex: 30,
      pointerEvents: 'none',
    }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 380, pointerEvents: 'auto' }}>
        <svg
          width="100%" height={BAR_H + POP + GAP}
          viewBox={`0 0 380 ${BAR_H + POP + GAP}`}
          preserveAspectRatio="none"
          style={{ display: 'block', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.22))' }}
        >
          <defs>
            <mask id="nav-cutout">
              <rect width="380" height={BAR_H + POP + GAP} fill="#fff" />
              <circle cx="190" cy={GAP + FAB_SIZE / 2} r={CUTOUT_R} fill="#000" />
            </mask>
          </defs>
          <rect x="0" y={POP + GAP} width="380" height={BAR_H} rx={BAR_H / 2} ry={BAR_H / 2} fill="#1A1612" mask="url(#nav-cutout)" />
        </svg>

        <div style={{
          position: 'absolute', left: 0, right: 0, top: POP + GAP, height: BAR_H,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
          alignItems: 'center',
        }}>
          {items.map(it => it.center ? (
            <div key={it.id} />
          ) : (
            <NavItem key={it.id} item={it} active={tab === it.id} onClick={() => { haptic.light(); setTab(it.id); }} />
          ))}
        </div>

        <button onClick={() => { haptic.medium(); openAdd(); }} aria-label="Добавить партию" style={{
          position: 'absolute', left: '50%', top: GAP,
          transform: 'translateX(-50%)',
          width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
          background: '#FFFFFF', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.10)',
          padding: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="#1A1612" strokeWidth="2.2" strokeLinecap="round">
            <path d="M11 4v14M4 11h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
