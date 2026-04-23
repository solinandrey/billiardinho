// Design tokens
export const CREAM  = '#F5EFE4';
export const CREAM2 = '#EFE7D8';
export const INK    = '#1A1612';
export const INK2   = '#3A342B';
export const MUTED  = '#8A8070';
export const LINE   = 'rgba(26,22,18,0.09)';

export const eloColor = (v) => {
  if (v >= 7) return '#2E9B5E';
  if (v >= 5) return '#3A73D1';
  if (v >= 3) return '#D19A2E';
  return '#D14A3A';
};

// Default player colors (assigned by registration order)
export const PLAYER_COLORS = [
  '#E8542A',
  '#4F7FE8',
  '#2ECC7A',
  '#A855F7',
  '#E5A83A',
  '#E3457F',
  '#2BB8CC',
  '#6B8E23',
];
