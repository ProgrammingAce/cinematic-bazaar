import type { GameEvent } from '../../framework/shared/types';

export type PongEvent =
  | (GameEvent & { type: 'score'; scorer: 0 | 1 })
  | (GameEvent & { type: 'paddle_hit'; paddleIndex: 0 | 1 });
