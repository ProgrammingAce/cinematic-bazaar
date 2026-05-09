// ============================================================
// Warlords - Game Constants
// ============================================================

// Arena dimensions (framework canvas is 800x600)
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// Castle configuration
export const CASTLE_SIZE = 192; // 6 bricks * 32px
export const BRICK_WIDTH = 32;
export const BRICK_HEIGHT = 32;
export const BRICK_HP = 2;

// Castle corner positions (top-left, top-right, bottom-left, bottom-right)
// Positioned in the corners of the playable area (border is at 20px)
export const CASTLE_POSITIONS = [
  { x: 20, y: 20 },
  { x: CANVAS_WIDTH - 20 - CASTLE_SIZE, y: 20 },
  { x: 20, y: CANVAS_HEIGHT - 20 - CASTLE_SIZE },
  { x: CANVAS_WIDTH - 20 - CASTLE_SIZE, y: CANVAS_HEIGHT - 20 - CASTLE_SIZE },
];

// Shield configuration
export const SHIELD_WIDTH = 45;
export const SHIELD_HEIGHT = 12;
export const SHIELD_SPEED = 0.024; // radians per frame (human)
export const SHIELD_SPEED_AI = 0.012; // half speed for AI

// Fireball configuration
export const FIREBALL_RADIUS = 6;
export const FIREBALL_SPEED_SLOW = 2.5;
export const FIREBALL_SPEED_FAST = 5;
export const MAX_FIREBALLS = 4;
export const BOUNCE_LIMIT = 60;

// Game configuration
export const BATTLES_TO_WIN_WAR = 3;
export const GAME_TICK_RATE = 60; // Hz
export const TICK_MS = 1000 / GAME_TICK_RATE;

// Ghost configuration
export const GHOST_DEFLCHANCE = 0.02;
export const GHOST_RADIUS = 20;

// Dragon configuration
export const DRAGON_SIZE = 24;
export const DRAGON_APPEAR_TIME = 180; // frames (3 seconds at 60fps)
export const DRAGON_BALL_DELAY = 60; // frames after appearing before launching

// AI configuration
export const AI_CONFIG = {
  shieldSpeed: SHIELD_SPEED_AI,
  reactionDelay: 15,
  throwAccuracy: 0.6,
  predictBalls: true,
};

// Player color mapping
export const PLAYER_COLORS: Record<number, string> = {
  0: '#ffff00',
  1: '#ffffff',
  2: '#ff4444',
  3: '#4488ff',
};

// Player names for display
export const PLAYER_NAMES = ['P1', 'P2', 'P3', 'P4'];

// Get shield position from angle
export function getShieldPosition(angle: number, cornerIndex: number): { x: number; y: number; angle: number } {
  const pos = CASTLE_POSITIONS[cornerIndex];
  const cx = pos.x + CASTLE_SIZE / 2;
  const cy = pos.y + CASTLE_SIZE / 2;
  const orbitRadius = (CASTLE_SIZE / 2 + 16) * 1.25;
  const x = cx + orbitRadius * Math.cos(angle);
  const y = cy + orbitRadius * Math.sin(angle);
  const facingAngle = angle + Math.PI / 2;
  return { x, y, angle: facingAngle };
}

// Settings definitions for the lobby
export const GAME_SETTINGS = [
  { key: 'ballSpeed', label: 'Ball Speed', type: 'select' as const, default: 'fast' as const, options: ['fast', 'slow'] },
  { key: 'shieldSpeed', label: 'Shield Speed', type: 'range' as const, default: 9, min: 1, max: 20, step: 1 },
  { key: 'battlesToWin', label: 'Battles to Win', type: 'range' as const, default: 3, min: 1, max: 7, step: 1 },
];
