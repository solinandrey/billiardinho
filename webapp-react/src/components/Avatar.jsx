import { useState, useEffect } from 'react';

/**
 * Avatar circle.
 *
 * Renders the uploaded image at /api/avatar/<id>?v=<avatar_updated_at> if the
 * player has one (avatar_v truthy), otherwise the initials chip on `player.color`.
 * Falls back to initials automatically if the image fails to load.
 */
export function Avatar({ player, size = 40, ring = false, style = {} }) {
  const fs = Math.round(size * 0.42);
  const [imgFailed, setImgFailed] = useState(false);

  // If the version stamp changes (user re-uploaded), retry the image.
  useEffect(() => { setImgFailed(false); }, [player?.avatar_v]);

  const src = player?.avatar_v && !imgFailed
    ? `/api/avatar/${player.avatarUserId ?? player.id}?v=${encodeURIComponent(player.avatar_v)}`
    : null;

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: player.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Archivo Black, system-ui, sans-serif',
      color: '#fff', fontSize: fs, letterSpacing: -0.5,
      boxShadow: ring ? `0 0 0 3px var(--bg, #F5EFE4), 0 0 0 4.5px ${player.color}` : 'none',
      flexShrink: 0, overflow: 'hidden', position: 'relative', ...style,
    }}>
      {src ? (
        <img
          src={src}
          alt=""
          onError={() => setImgFailed(true)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
          }}
        />
      ) : (
        player.short
      )}
    </div>
  );
}
