import {Easing} from 'remotion';

export const C = {
  navy: '#1B2A4A',
  navyHi: '#2A3F6B',
  navyMid: '#223459',
  gold: '#E0A33B',
  goldHi: '#F5C978',
  goldDeep: '#A8741F',
  cream: '#F6ECDA',
  paper: '#FBF6EC',
  ink: '#0E1626',
  red: '#E5484D',
  green: '#30A46C',
  muted: 'rgba(246,236,218,0.62)',
};

export const F = {
  slab: '"Alfa Slab One", Georgia, serif',
  inter: 'Inter, system-ui, sans-serif',
  serif: '"Playfair Display", Georgia, serif',
  mono: '"Courier Prime", "Courier New", monospace',
};

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const SAFE = 96;

// Never linear: one family of curves used everywhere so motion feels like one hand.
export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1), // expo-like settle
  outSoft: Easing.bezier(0.25, 0.8, 0.25, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.55, 0, 0.9, 0.35),
  snap: Easing.bezier(0.7, 0, 0.2, 1),
};

export const GOLD_FOIL = `linear-gradient(115deg, ${C.goldDeep} 0%, ${C.goldHi} 28%, #FFE7B0 38%, ${C.gold} 52%, ${C.goldDeep} 78%, ${C.goldHi} 100%)`;
