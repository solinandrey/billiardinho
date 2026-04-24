import { useState } from 'react';
import { MUTED, INK, LINE } from '../theme.js';
import { Avatar } from '../components/Avatar.jsx';
import { Card } from '../components/Card.jsx';
import { FeedCard } from '../components/FeedCard.jsx';
import { Icon } from '../components/Icon.jsx';

const PERIODS = ['3М', '6М', '1Г', 'Всё'];
const CREAM2 = '#EFE7D8';

function filterByPeriod(games, period) {
  if (period === 'Всё') return games;
  const now = new Date();
  const months = period === '3М' ? 3 : period === '6М' ? 6 : 12;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return games.filter(g => new Date(g.date) >= cutoff);
}

export function H2HScreen({ a, b, byId, games, winnerOf, relativeDate, go, goBack }) {
  const p1 = byId[a];
  const p2 = byId[b];
  const [period, setPeriod] = useState('Всё');

  const allGames = games.filter(g => (g.p1 === a && g.p2 === b) || (g.p1 === b && g.p2 === a));
  const filteredGames = filterByPeriod(allGames, period);

  // Record
  let xw = 0, yw = 0, d = 0;
  for (const g of filteredGames) {
    const w = winnerOf(g);
    if (w === null) d++;
    else if (w === a) xw++;
    else yw++;
  }
  const total = xw + yw + d;

  // Points totals
  let sum1 = 0, sum2 = 0;
  for (const g of filteredGames) {
    if (g.p1 === a) { sum1 += g.s1; sum2 += g.s2; }
    else { sum1 += g.s2; sum2 += g.s1; }
  }
  const avg1 = filteredGames.length ? (sum1 / filteredGames.length).toFixed(1) : '0';
  const avg2 = filteredGames.length ? (sum2 / filteredGames.length).toFixed(1) : '0';

  // Longest winning streak ever (in either direction).
  // filteredGames is newest-first; iterate oldest-first to find max run of same winner.
  let longestStreak = 0, longestOwner = null;
  {
    let curOwner = null, curLen = 0;
    for (const g of [...filteredGames].reverse()) {
      const w = winnerOf(g);
      if (!w) { curOwner = null; curLen = 0; continue; }
      if (w === curOwner) curLen++;
      else { curOwner = w; curLen = 1; }
      if (curLen > longestStreak) { longestStreak = curLen; longestOwner = w; }
    }
  }

  // Records
  const winsByP1 = filteredGames.filter(g => winnerOf(g) === a);
  const winsByP2 = filteredGames.filter(g => winnerOf(g) === b);
  const biggestWin = (arr, pid) => {
    if (!arr.length) return null;
    let best = arr[0];
    let bestMargin = Math.abs(best.s1 - best.s2);
    for (const g of arr) {
      const m = Math.abs(g.s1 - g.s2);
      if (m > bestMargin) { best = g; bestMargin = m; }
    }
    const myScore  = best.p1 === pid ? best.s1 : best.s2;
    const oppScore = best.p1 === pid ? best.s2 : best.s1;
    return { game: best, margin: bestMargin, myScore, oppScore };
  };
  const bigA = biggestWin(winsByP1, a);
  const bigB = biggestWin(winsByP2, b);
  const topScoring = filteredGames.length
    ? filteredGames.reduce((m, g) => (g.s1 + g.s2) > (m.s1 + m.s2) ? g : m, filteredGames[0])
    : null;

  // Bar chart (oldest → newest)
  const barGames = filteredGames.slice().reverse();
  const maxMargin = Math.max(2, ...barGames.map(g => Math.abs(g.s1 - g.s2)));
  const CHART_H = 110;
  const mid = CHART_H / 2;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F5EFE4' }}>
      {/* Header */}
      <div style={{ padding: '50px 18px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={goBack} style={{
          width: 38, height: 38, borderRadius: 19, background: '#FFFBF2', border: `1px solid ${LINE}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{Icon.back(INK)}</button>
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Личная встреча</div>
      </div>

      {/* VS card */}
      <div style={{ padding: '0 20px' }}>
        <Card style={{ padding: '22px 18px', background: '#FFFBF2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <Avatar player={p1} size={58} style={{ margin: '0 auto' }} />
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>{p1.name}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 8px' }}>
              <div style={{ fontFamily: 'Archivo Black', fontSize: 40, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: p1.color }}>{xw}</span>
                <span style={{ color: MUTED, fontSize: 22, padding: '0 6px', verticalAlign: 'middle' }}>:</span>
                <span style={{ color: p2.color }}>{yw}</span>
              </div>
              <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, letterSpacing: 0.5, marginTop: -2 }}>
                встреч {total}{d ? ` · ${d} ничьи` : ''}
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${LINE}` }}>
                <div style={{ fontFamily: 'Archivo Black', fontSize: 22, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: p1.color }}>{sum1}</span>
                  <span style={{ color: MUTED, fontSize: 14, padding: '0 4px', verticalAlign: 'middle' }}>:</span>
                  <span style={{ color: p2.color }}>{sum2}</span>
                </div>
                <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, letterSpacing: 0.5, marginTop: -1 }}>партии · всего</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <Avatar player={p2} size={58} style={{ margin: '0 auto' }} />
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>{p2.name}</div>
            </div>
          </div>
          {/* Win-share bar */}
          <div style={{ marginTop: 16, height: 8, borderRadius: 4, background: CREAM2, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: `${(xw / Math.max(1, total)) * 100}%`, background: p1.color }} />
            <div style={{ width: `${(d / Math.max(1, total)) * 100}%`, background: MUTED }} />
            <div style={{ width: `${(yw / Math.max(1, total)) * 100}%`, background: p2.color }} />
          </div>
        </Card>
      </div>

      {/* Extra stats */}
      <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'Средний счёт', val: `${avg1} : ${avg2}` },
          { label: 'Ничьи', val: d },
          {
            label: 'Макс. серия',
            val: longestOwner ? `${longestStreak} · ${byId[longestOwner].short}` : '—',
            hint: longestOwner ? `подряд у ${byId[longestOwner].name}` : null,
          },
        ].map((s, i) => (
          <Card key={i} style={{ padding: '10px 10px', textAlign: 'center' }} title={s.hint || undefined}>
            <div style={{ fontFamily: 'Archivo Black', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
            <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Records */}
      {(bigA || bigB || topScoring) && (
        <div style={{ padding: '4px 20px 0' }}>
          <div style={{ fontFamily: 'Archivo Black', fontSize: 15, letterSpacing: -0.2, margin: '8px 0 8px' }}>Рекорды</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Biggest wins row */}
            {(bigA || bigB) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[{ big: bigA, player: p1 }, { big: bigB, player: p2 }].map(({ big, player }, i) => (
                  <Card key={i} onClick={big ? () => go('game', { gameId: big.game.id }) : undefined}
                    style={{ padding: '10px 12px', cursor: big ? 'pointer' : 'default', opacity: big ? 1 : 0.5 }}>
                    <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      Крупнейшая победа
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontFamily: 'Archivo Black', fontSize: 18, fontVariantNumeric: 'tabular-nums', color: player.color }}>
                        {big ? `${big.myScore}:${big.oppScore}` : '—'}
                      </div>
                      {big && (
                        <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700 }}>
                          +{big.margin}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: INK, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.name}
                    </div>
                    {big && (
                      <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>
                        {relativeDate(big.game.date)}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Top-scoring match */}
            {topScoring && (
              <Card onClick={() => go('game', { gameId: topScoring.id })} style={{ padding: '10px 12px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      Самый результативный матч
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {relativeDate(topScoring.date)} · всего {topScoring.s1 + topScoring.s2} очков
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Archivo Black', fontSize: 22, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>
                    <span style={{ color: topScoring.p1 === a ? p1.color : p2.color }}>{topScoring.s1}</span>
                    <span style={{ color: MUTED, padding: '0 4px', fontSize: 14 }}>:</span>
                    <span style={{ color: topScoring.p2 === a ? p1.color : p2.color }}>{topScoring.s2}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Period selector */}
      <div style={{ padding: '10px 20px 0', display: 'flex', gap: 6 }}>
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            flex: 1, padding: '8px 0', borderRadius: 12,
            background: period === p ? INK : 'transparent',
            color: period === p ? '#F5EFE4' : INK,
            border: period === p ? 'none' : `1px solid ${LINE}`,
            fontWeight: 700, fontSize: 12, letterSpacing: 0.3, cursor: 'pointer',
          }}>{p}</button>
        ))}
      </div>

      {/* Form / momentum bars */}
      <div style={{ padding: '14px 20px 0' }}>
        <Card style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Archivo Black', fontSize: 15, letterSpacing: -0.2 }}>Форма встреч</div>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>{barGames.length} игр</div>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>
            От старой к новой · высота столбца = разница в счёте
          </div>

          {barGames.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: MUTED }}>Нет игр за выбранный период</div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{
                display: 'flex', alignItems: 'stretch', gap: 3, height: CHART_H,
                borderTop: `1px dashed ${LINE}`, borderBottom: `1px dashed ${LINE}`, position: 'relative',
              }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: mid, height: 1, background: INK, opacity: 0.25 }} />
                {barGames.map((g, i) => {
                  const w = winnerOf(g);
                  const isP1win = w === a;
                  const isP2win = w === b;
                  const margin = Math.abs(g.s1 - g.s2);
                  const hPx = (margin / maxMargin) * (mid - 4);
                  let barColor = MUTED, barTop = mid - 1.5, barH = 3;
                  if (isP1win) { barColor = p1.color; barTop = mid - hPx; barH = hPx; }
                  else if (isP2win) { barColor = p2.color; barTop = mid; barH = hPx; }
                  return (
                    <div key={g.id} style={{ flex: 1, position: 'relative', cursor: 'pointer' }} onClick={() => go('game', { gameId: g.id })}>
                      <div style={{ position: 'absolute', left: 0, right: 0, top: barTop, height: Math.max(barH, 3), background: barColor, borderRadius: 2 }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: MUTED, fontWeight: 600, letterSpacing: 0.3 }}>
                <span>{barGames[0] ? new Date(barGames[0].date).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }) : ''}</span>
                <span>→ сегодня</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: INK, fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: p1.color }} />
              побед {p1.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: p2.color }} />
              побед {p2.name}
            </div>
          </div>
        </Card>
      </div>

      {/* Game history */}
      <div style={{ padding: '18px 20px 40px' }}>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 16, letterSpacing: -0.2, marginBottom: 10 }}>История встреч</div>
        {filteredGames.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: MUTED }}>Нет партий за выбранный период</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredGames.map(g => (
              <FeedCard key={g.id} game={g} byId={byId} winnerOf={winnerOf} relativeDate={relativeDate} onClick={() => go('game', { gameId: g.id })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
