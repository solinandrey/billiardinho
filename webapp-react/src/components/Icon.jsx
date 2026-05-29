// Nav-bar tab icons come in `solid` (active) + outline (inactive) variants
// for crisper contrast on small phone screens. shape-rendering hints help
// some webkit builds avoid a faint blur on thin strokes at 1× density.
const NAV_SIZE = 24;
const NAV_STROKE = 2.25;
const NAV_PROPS = {
  width: NAV_SIZE, height: NAV_SIZE,
  viewBox: '0 0 24 24',
  shapeRendering: 'geometricPrecision',
};

export const Icon = {
  home: (c, solid) => solid ? (
    <svg {...NAV_PROPS} fill={c}>
      <path d="M3.5 10.4L12 3.5l8.5 6.9V19.2a1.6 1.6 0 0 1-1.6 1.6h-3.7v-5.6h-6.4v5.6H5.1a1.6 1.6 0 0 1-1.6-1.6V10.4Z"/>
    </svg>
  ) : (
    <svg {...NAV_PROPS} fill="none" stroke={c} strokeWidth={NAV_STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 10.4L12 3.5l8.5 6.9V19.2a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6V10.4Z"/>
      <path d="M9.2 20.8v-5.6h5.6v5.6"/>
    </svg>
  ),
  trophy: (c, solid) => solid ? (
    <svg {...NAV_PROPS} fill={c}>
      <path d="M7 3.5h10v4.5a5 5 0 0 1-10 0V3.5Z"/>
      <path d="M5.5 4.5H3a.9.9 0 0 0-.9.9v.6c0 2.5 1.7 4.4 4.1 4.7l-.5-1.7c-1.3-.4-2.1-1.5-2.2-3v-.1h2v-1.4ZM18.5 4.5H21a.9.9 0 0 1 .9.9v.6c0 2.5-1.7 4.4-4.1 4.7l.5-1.7c1.3-.4 2.1-1.5 2.2-3v-.1h-2v-1.4Z"/>
      <path d="M9 14.5h6l-.5 3.2h-5L9 14.5ZM7.5 18.7h9v1.8h-9z"/>
    </svg>
  ) : (
    <svg {...NAV_PROPS} fill="none" stroke={c} strokeWidth={NAV_STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h10v4.5a5 5 0 0 1-10 0V3.5Z"/>
      <path d="M7 5.5H3.5c-.5 2 .5 4.5 3.5 5.2M17 5.5h3.5c.5 2-.5 4.5-3.5 5.2"/>
      <path d="M9 14.5h6l-.5 3.2h-5L9 14.5Z"/>
      <path d="M7.5 19.6h9"/>
    </svg>
  ),
  chart: (c, solid) => solid ? (
    <svg {...NAV_PROPS} fill={c}>
      <rect x="3.5" y="9.5" width="3.5" height="10" rx="0.8"/>
      <rect x="10.25" y="12.5" width="3.5" height="7" rx="0.8"/>
      <rect x="17" y="4.5" width="3.5" height="15" rx="0.8"/>
      <path d="M2.5 21.5h19" stroke={c} strokeWidth={NAV_STROKE} strokeLinecap="round" fill="none"/>
    </svg>
  ) : (
    <svg {...NAV_PROPS} fill="none" stroke={c} strokeWidth={NAV_STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.25 19.5V9.5M12 19.5v-7M18.75 19.5V4.5"/>
      <path d="M3 21.5h18"/>
    </svg>
  ),
  plus: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  back: (c) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l-6 6 6 6"/></svg>,
  chev: (c) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l5 4-5 4"/></svg>,
  calendar: (c) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><rect x="2.5" y="4" width="13" height="11" rx="2"/><path d="M6 2.5v3M12 2.5v3M2.5 8h13"/></svg>,
  crown: (c) => <svg width="18" height="14" viewBox="0 0 18 14" fill={c}><path d="M1.5 4l2.5 3.5L7 2l2 5.5L11 2l3 5.5L16.5 4v7.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V4Z"/></svg>,
  user: (c, solid) => solid ? (
    <svg {...NAV_PROPS} fill={c}>
      <circle cx="12" cy="8.5" r="4"/>
      <path d="M3.8 21c1.6-3.6 4.5-5 8.2-5s6.6 1.4 8.2 5H3.8Z"/>
    </svg>
  ) : (
    <svg {...NAV_PROPS} fill="none" stroke={c} strokeWidth={NAV_STROKE} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8.5" r="4"/>
      <path d="M3.8 21c1.6-3.6 4.5-5 8.2-5s6.6 1.4 8.2 5"/>
    </svg>
  ),
  search: (c) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5"/><path d="M12 12l4 4"/></svg>,
  gear: (c) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14" x2="17" y2="14"/><circle cx="13" cy="6" r="2.2" fill={c} stroke="none"/><circle cx="7" cy="10" r="2.2" fill={c} stroke="none"/><circle cx="12" cy="14" r="2.2" fill={c} stroke="none"/></svg>,
  pencil: (c) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 2.5l3 3L6 13l-3.5.5L3 10z"/><path d="M9 4l3 3"/></svg>,
  trash: (c) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5h10M6.5 4.5V3.2a.9.9 0 0 1 .9-.9h1.2a.9.9 0 0 1 .9.9V4.5M4.3 4.5l.7 8.5a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.7-8.5"/><path d="M6.5 7v4.5M9.5 7v4.5"/></svg>,
};
