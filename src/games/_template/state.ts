import type { BaseGameState, BasePlayer, GameConfig, PlayerColor } from '../../framework/shared/types';
import { GAME_DURATION_S } from './constants';

// Extend BasePlayer with any per-player fields your game needs.
export interface TemplatePlayer extends BasePlayer {
  x: number;
  y: number;
  // TODO: add game-specific fields
}

// Extend BaseGameState with shared game fields.
export interface TemplateState extends BaseGameState {
  phase: 'playing' | 'game_over'; // extend freely (e.g. 'round_end')
  players: TemplatePlayer[];
  timeRemaining: number;
  // TODO: add world/item/ball state here
}

export function createInitialState(config: GameConfig): TemplateState {
  return {
    tick: 0,
    phase: 'playing',
    timeRemaining: GAME_DURATION_S,
    players: config.playerIds.map((id, i) => ({
      id,
      name: config.playerNames[i],
      color: config.playerColors[i] as PlayerColor,
      score: 0,
      isAI: config.aiSlots.includes(id),
      connected: true,
      x: 100 + i * 150, // TODO: real start positions
      y: 300,
    })),
  };
}
