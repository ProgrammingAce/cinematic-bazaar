import type { BaseGameState, BasePlayer, GameConfig, PlayerId, PlayerColor } from '../../framework/shared/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CASTLE_SIZE, BRICK_WIDTH, BRICK_HEIGHT, BRICK_HP, CASTLE_POSITIONS } from './constants';

// Brick segment in a castle
export interface Brick {
  x: number;
  y: number;
  hp: number; // 0 = destroyed, 1 = damaged, 2 = full
  flashTimer: number;
}

// Castle state
export interface Castle {
  bricks: Brick[];
  destroyed: boolean;
  warlordAlive: boolean;
}

// Shield state
export interface Shield {
  angle: number; // 0.0 to 2π
}

// Fireball state
export interface Fireball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  spin: number;
  owner: PlayerId | null;
  bounceCount: number;
}

// Extended player with game-specific fields
export interface WarlordsPlayer extends BasePlayer {
  castle: Castle;
  shield: Shield;
  alive: boolean;
  ghostX: number;
  ghostY: number;
  ghostActive: boolean;
  ghostTimer: number;
}

// Game state
export interface WarlordsState extends BaseGameState {
  phase: 'playing' | 'dragon' | 'battle_end' | 'game_over';
  players: WarlordsPlayer[];
  balls: Fireball[];
  battleNumber: number;
  winner: PlayerId | null;
  dragonX: number;
  dragonY: number;
  dragonTimer: number;
  battlesToWin: number;
  ballSpeed: 'fast' | 'slow';
  shieldSpeed: number;
  _battleResetTick?: number; // internal: tick at which to reset battle
}

// --- Castle helpers ---

function getBrickLayout(): { x: number; y: number }[] {
  const bricks: { x: number; y: number }[] = [];
  const cols = 6;
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({ x: c * BRICK_WIDTH, y: r * BRICK_HEIGHT });
    }
  }
  return bricks;
}

export function createCastle(cornerIndex: number): Castle {
  const layout = getBrickLayout();
  const pos = CASTLE_POSITIONS[cornerIndex];
  const bricks = layout.map(b => ({
    x: pos.x + b.x,
    y: pos.y + b.y,
    hp: BRICK_HP,
    flashTimer: 0,
  }));
  return { bricks, destroyed: false, warlordAlive: true };
}

export function createShield(): Shield {
  return { angle: 0 };
}

// --- State creation ---

export function createInitialState(config: GameConfig): WarlordsState {
  const battlesToWin = Number(config.settings['battlesToWin'] ?? 3);
  const ballSpeed = (config.settings['ballSpeed'] as 'fast' | 'slow') ?? 'fast';
  const shieldSpeedPct = Number(config.settings['shieldSpeed'] ?? 9);

  // Build full player list: human players + AI filler slots
  const allPlayerIds = [...config.playerIds, ...config.aiSlots] as PlayerId[];

  const players: WarlordsPlayer[] = allPlayerIds.map((id) => {
    const humanIndex = config.playerIds.indexOf(id);
    return {
      id,
      name: humanIndex >= 0 ? config.playerNames[humanIndex] : `AI ${id + 1}`,
      color: humanIndex >= 0 ? config.playerColors[humanIndex] as PlayerColor : (['yellow', 'white', 'red', 'blue', 'green', 'orange', 'magenta', 'cyan'] as PlayerColor[])[id],
      score: 0,
      isAI: config.aiSlots.includes(id),
      connected: true,
      castle: createCastle(id),
      shield: createShield(),
      alive: true,
      ghostX: 0,
      ghostY: 0,
      ghostActive: false,
      ghostTimer: 0,
    };
  });

  return {
    tick: 0,
    phase: 'dragon',
    players,
    balls: [],
    battleNumber: 1,
    winner: null,
    dragonX: CANVAS_WIDTH / 2,
    dragonY: 50,
    dragonTimer: 0,
    battlesToWin,
    ballSpeed,
    shieldSpeed: shieldSpeedPct,
  };
}
