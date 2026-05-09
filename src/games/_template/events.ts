import type { PlayerId } from '../../framework/shared/types';

// Define every event your game can emit from tick(). Wire reactions in definition.ts clientHooks.
// Delete this file entirely if your game emits no events.
export type TemplateEvent =
  | { type: 'player_scored'; playerId: PlayerId; points: number };
  // | { type: 'item_spawned'; x: number; y: number };
