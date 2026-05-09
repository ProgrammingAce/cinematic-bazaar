import type { PlayerId } from '../../framework/shared/types';

export type TetrominoEvent =
  | { type: 'lines_cleared'; playerId: PlayerId; count: number }
  | { type: 'player_dead'; playerId: PlayerId };
