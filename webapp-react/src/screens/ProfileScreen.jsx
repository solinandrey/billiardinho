import { useRef, useState, useEffect } from 'react';
import { MUTED, INK, LINE } from '../theme.js';
import { Avatar } from '../components/Avatar.jsx';
import { Card } from '../components/Card.jsx';
import { FeedCard } from '../components/FeedCard.jsx';
import { Icon } from '../components/Icon.jsx';
import { SettingsSheet } from './SettingsSheet.jsx';

export function ProfileScreen({ playerId, meId, players, games, byId, winnerOf, relativeDate, recordBetween, gamesBetween, rivalsOf, recentGamesOf, ratingHistoryOf, go, goBack, fromRoot, onSaveSettings, onAvatarUpload, onAvatarRemove }) {
  const p = byId[playerId];
  const winPct = p.games ? Math.round(p.wins * 100 / p.games) : 0;
  const rivals = rivalsOf(p.id).filter(r => r.total > 0);
  const recent = recentGamesOf(p.id, 10);
  const history = ratingHistoryOf ? ratingHistoryOf(p.id) : [];
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const CREAM2 = '#EFE7D8';

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const on = () => setScrolled(el.scrollTop > 120);
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {/* Sticky header (appears on scroll) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        background: p.color, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: scrolled ? '0 4px 14px rgba(0,0,0,0.10)' : 'none',
        transform: scrolled ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 240ms ease, box-shadow 240ms ease',
        pointerEvents: scrolled ? 'auto' : 'none',
      }}>
        <button onClick={goBack || (() => {})} style={{
          width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.22)',
          border: 'none', cursor: 'pointer', display: goBack ? 'flex' : 'none',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{Icon.back('#fff')}</button>
        <div style={{
          width: 36, height: 36, borderRadius: 18, background: '#fff', color: p.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Archivo Black', fontSize: 16, letterSpacing: -0.5, flexShrink: 0,
        }}>{p.short}</div>
        <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
          <div style={{ fontFamily: 'Archivo Black', fontSize: 16, letterSpacing: -0.3, lineHeight: 1.1 }}>{p.name}</div>
          <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600, letterSpacing: 0.3 }}>
            Рейтинг {p.elo.toFixed(2)} · {p.games} игр · {winPct}%
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto' }}>
        {/* Colored header */}
        <div style={{
          background: p.color, padding: '14px 18px 18px',
          borderRadius: '0 0 26px 26px', position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative concentric rings — centered on avatar */}
          <svg
            style={{
              position: 'absolute', left: 58, top: 58,
              transform: 'translate(-50%, -50%)',
              opacity: 0.18, pointerEvents: 'none',
            }}
            width="260" height="260" viewBox="0 0 220 220"
          >
            <circle cx="110" cy="110" r="95" stroke="#fff" strokeWidth="1.2" fill="none" strokeDasharray="2 6" />
            <circle cx="110" cy="110" r="70" stroke="#fff" strokeWidth="1.2" fill="none" />
            <circle cx="110" cy="110" r="45" stroke="#fff" strokeWidth="1.2" fill="none" strokeDasharray="2 6" />
          </svg>

          {/* Floating back button (top-left corner) */}
          {goBack && (
            <button onClick={goBack} style={{
              position: 'absolute', top: 12, left: 12, zIndex: 2,
              width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.28)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{Icon.back('#fff')}</button>
          )}

          {/* Floating settings button (top-right corner) */}
          {fromRoot && (
            <button onClick={() => setSettingsOpen(true)} aria-label="Настройки" style={{
              position: 'absolute', top: 12, right: 12, zIndex: 2,
              width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.28)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}>
              {Icon.gear('#fff')}
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', paddingLeft: goBack ? 36 : 0, paddingRight: fromRoot ? 36 : 0 }}>
            <Avatar player={p} size={72} style={{
              boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
              border: '2px solid rgba(255,255,255,0.55)',
            }} />
            <div style={{ color: '#fff', minWidth: 0 }}>
              <div style={{ fontFamily: 'Archivo Black', fontSize: 22, letterSpacing: -0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
                background: 'rgba(255,255,255,0.22)', padding: '4px 10px 4px 8px', borderRadius: 999,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>Рейтинг</span>
                <span style={{ fontFamily: 'Archivo Black', fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{p.elo.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Stat pills */}
          <div style={{
            marginTop: 18, background: 'rgba(255,255,255,0.32)', borderRadius: 18,
            padding: '10px 4px', display: 'flex', position: 'relative',
          }}>
            {[
              { label: 'игр',    val: p.games   },
              { label: 'побед',  val: p.wins    },
              { label: 'винрейт', val: winPct + '%' },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', color: '#fff',
                borderLeft: i ? '1px solid rgba(255,255,255,0.25)' : 'none',
              }}>
                <div style={{ fontFamily: 'Archivo Black', fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
                <div style={{ fontSize: 10.5, opacity: 0.9, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Rating history sparkline */}
          {history.length >= 2 && (() => {
            const W = 320, H = 56, PADX = 6, PADY = 8;
            const vals = history.map(h => h.rating);
            const minR = Math.min(...vals);
            const maxR = Math.max(...vals);
            const span = Math.max(0.4, maxR - minR); // min 0.4 range для визуальной амплитуды
            const midR = (minR + maxR) / 2;
            const lo = midR - span / 2;
            const xFor = i => PADX + (i / (history.length - 1)) * (W - 2 * PADX);
            const yFor = r => PADY + (1 - (r - lo) / span) * (H - 2 * PADY);
            const dPath = history.map((h, i) => `${i ? 'L' : 'M'} ${xFor(i).toFixed(1)} ${yFor(h.rating).toFixed(1)}`).join(' ');
            const areaPath = `${dPath} L ${xFor(history.length - 1).toFixed(1)} ${(H - PADY).toFixed(1)} L ${xFor(0).toFixed(1)} ${(H - PADY).toFixed(1)} Z`;
            const first = history[0].rating;
            const last  = history[history.length - 1].rating;
            const delta = Math.round((last - first) * 100) / 100;
            const deltaSign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
            const deltaAbs = Math.abs(delta).toFixed(2);

            return (
              <div style={{ marginTop: 14, position: 'relative' }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  color: '#fff', marginBottom: 4,
                }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.85 }}>
                    Рейтинг · {history.length} партий
                  </span>
                  <span style={{
                    fontFamily: 'Archivo Black', fontSize: 12, fontVariantNumeric: 'tabular-nums',
                    padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.24)',
                  }}>
                    {deltaSign}{deltaAbs}
                  </span>
                </div>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                  <path d={areaPath} fill="rgba(255,255,255,0.16)" />
                  <path d={dPath} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  {/* last-point dot */}
                  <circle cx={xFor(history.length - 1)} cy={yFor(last)} r="3" fill="#fff" />
                </svg>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  <span>{first.toFixed(2)}</span>
                  <span>{last.toFixed(2)}</span>
                </div>
              </div>
            );
          })()}
        </div>

        <div style={{ padding: '22px 20px 110px' }}>
          {/* vs me (only on other player profiles) */}
          {p.id !== meId && (() => {
            const me = byId[meId];
            const rec = recordBetween(meId, p.id);
            const total = rec.xw + rec.yw + rec.d;
            const ourGames = gamesBetween(meId, p.id).sort((a, b) => new Date(b.date) - new Date(a.date));
            const myWinPct = total ? Math.round(rec.xw * 100 / total) : 0;
            return (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontFamily: 'Archivo Black', fontSize: 18, letterSpacing: -0.3 }}>Против меня</div>
                  {total > 0 && (
                    <button onClick={() => go('h2h', { a: meId, b: p.id })} style={{
                      background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: 12, fontWeight: 700, color: me.color, letterSpacing: 0.3,
                      display: 'flex', alignItems: 'center', gap: 2,
                    }}>Подробнее {Icon.chev(me.color)}</button>
                  )}
                </div>
                {total === 0 ? (
                  <Card style={{ padding: '18px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>Вы ещё не играли</div>
                  </Card>
                ) : (
                  <Card style={{ padding: '20px 18px 16px' }}>
                    {/* Heads row — avatars centered with names below */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <Avatar player={me} size={46} />
                        <div style={{
                          fontSize: 12, fontWeight: 700, color: INK, textAlign: 'center', lineHeight: 1.25,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          wordBreak: 'break-word',
                        }}>{me.name}</div>
                      </div>

                      <div style={{ textAlign: 'center', minWidth: 90 }}>
                        <div style={{
                          fontFamily: 'Archivo Black', fontSize: 38, letterSpacing: -1.2,
                          lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                        }}>
                          <span style={{ color: me.color }}>{rec.xw}</span>
                          <span style={{ color: MUTED, padding: '0 6px', fontSize: 24 }}>:</span>
                          <span style={{ color: p.color }}>{rec.yw}</span>
                        </div>
                        <div style={{
                          fontSize: 9.5, color: MUTED, fontWeight: 700, letterSpacing: 0.7,
                          textTransform: 'uppercase', marginTop: 8,
                        }}>Счёт встреч</div>
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <Avatar player={p} size={46} />
                        <div style={{
                          fontSize: 12, fontWeight: 700, color: INK, textAlign: 'center', lineHeight: 1.25,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          wordBreak: 'break-word',
                        }}>{p.name}</div>
                      </div>
                    </div>

                    {/* Win-share bar */}
                    <div style={{ marginTop: 18, height: 6, borderRadius: 3, background: CREAM2, display: 'flex', overflow: 'hidden' }}>
                      <div style={{ width: `${(rec.xw / total) * 100}%`, background: me.color }} />
                      <div style={{ width: `${(rec.d / total) * 100}%`, background: MUTED }} />
                      <div style={{ width: `${(rec.yw / total) * 100}%`, background: p.color }} />
                    </div>

                    {/* Stats grid */}
                    <div style={{
                      marginTop: 14, paddingTop: 14,
                      borderTop: `1px dashed ${LINE}`,
                      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
                    }}>
                      {[
                        { val: total, label: 'встреч' },
                        { val: rec.d,  label: 'ничьи' },
                        { val: `${myWinPct}%`, label: 'мой %', color: myWinPct >= 50 ? me.color : p.color },
                      ].map((s, i) => (
                        <div key={i} style={{ textAlign: 'center', borderLeft: i ? `1px solid ${LINE}` : 'none' }}>
                          <div style={{
                            fontFamily: 'Archivo Black', fontSize: 18, letterSpacing: -0.3,
                            color: s.color || INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                          }}>{s.val}</div>
                          <div style={{
                            fontSize: 9.5, color: MUTED, fontWeight: 700, letterSpacing: 0.6,
                            textTransform: 'uppercase', marginTop: 5,
                          }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {ourGames.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    {ourGames.slice(0, 3).map(g => (
                      <FeedCard key={g.id} game={g} byId={byId} winnerOf={winnerOf} relativeDate={relativeDate} onClick={() => go('game', { gameId: g.id })} />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Rivals */}
          {rivals.length > 0 && (
            <>
          <div style={{ fontFamily: 'Archivo Black', fontSize: 16, letterSpacing: -0.2, marginBottom: 8 }}>Соперники</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {rivals.map(r => {
              const total = r.w + r.l + r.d;
              const wFrac = total ? r.w / total : 0;
              return (
                <Card key={r.opp.id} onClick={() => go('h2h', { a: p.id, b: r.opp.id })}
                  style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar player={r.opp} size={38} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{r.opp.name}</div>
                    <div style={{ height: 5, borderRadius: 3, background: CREAM2, marginTop: 6, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${wFrac * 100}%`, background: p.color }} />
                      <div style={{ width: `${(r.d / (total || 1)) * 100}%`, background: MUTED }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Archivo Black', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: p.color }}>{r.w}</span>
                      <span style={{ color: MUTED, padding: '0 3px' }}>–</span>
                      <span style={{ color: r.opp.color }}>{r.l}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 600, letterSpacing: 0.3 }}>{r.pct}% win</div>
                  </div>
                  {Icon.chev(MUTED)}
                </Card>
              );
            })}
          </div>
            </>
          )}

          {/* Recent games */}
          <div style={{ fontFamily: 'Archivo Black', fontSize: 16, letterSpacing: -0.2, marginBottom: 8 }}>Последние партии</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recent.map(g => (
              <FeedCard key={g.id} game={g} byId={byId} winnerOf={winnerOf} relativeDate={relativeDate} onClick={() => go('game', { gameId: g.id })} />
            ))}
          </div>
        </div>
      </div>

      {settingsOpen && (
        <SettingsSheet
          player={p}
          onClose={() => setSettingsOpen(false)}
          onSaved={onSaveSettings}
          onAvatarUpload={onAvatarUpload}
          onAvatarRemove={onAvatarRemove}
        />
      )}
    </div>
  );
}
