import type { PlayerId } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const TICK_MS = 1000 / 60;
export const MAX_PLAYERS = 8;

export const PLAYER_COLORS: Record<PlayerId, string> = {
  0: '#ffff00',
  1: '#ffffff',
  2: '#ff4444',
  3: '#4488ff',
  4: '#44ff88',
  5: '#ff8844',
  6: '#ff44ff',
  7: '#44ffff',
};
