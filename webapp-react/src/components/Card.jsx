import { LINE } from '../theme.js';

export function Card({ children, bg = '#FFFBF2', style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: bg, borderRadius: 22,
      border: `1px solid ${LINE}`,
      boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 1px 2px rgba(40,30,20,0.04)',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>
      {children}
    </div>
  );
}
