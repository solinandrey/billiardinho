export function Avatar({ player, size = 40, ring = false, style = {} }) {
  const fs = Math.round(size * 0.42);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: player.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Archivo Black, system-ui, sans-serif',
      color: '#fff', fontSize: fs, letterSpacing: -0.5,
      boxShadow: ring ? `0 0 0 3px var(--bg, #F5EFE4), 0 0 0 4.5px ${player.color}` : 'none',
      flexShrink: 0, ...style,
    }}>
      {player.short}
    </div>
  );
}
