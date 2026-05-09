import type { PlayerId } from '../../framework/shared/types';

export type WarlordsEvent =
  | { type: 'brick_destroyed'; x: number; y: number; playerId: PlayerId }
  | { type: 'warlord_dead'; playerId: PlayerId }
  | { type: 'battle_won'; winner: PlayerId }
  | { type: 'war_won'; winner: PlayerId }
  | { type: 'ball_spawned'; x: number; y: number; vx: number; vy: number }
  | { type: 'shield_hit'; x: number; y: number; angle: number }
  | { type: 'battle_start'; battleNumber: number };
