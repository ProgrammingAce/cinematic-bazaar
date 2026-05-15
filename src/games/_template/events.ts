import type { PlayerId } from '../../framework/shared/types';

// Define every event your game can emit from tick(). Wire reactions in definition.ts clientHooks.
// If your game emits no events, delete this file and remove the events field from tick() returns.
//
// Full event lifecycle:
//   1. Define event types here (typed union)
//   2. Push events in engine.ts tick(): return { state: next, events: [{ type: '...', ... }] }
//   3. Wire client reactions in definition.ts clientHooks.onEvent(event, state)
//   4. (Optional) React in renderer.ts for frame-level visual feedback
export type TemplateEvent =
  | { type: 'player_scored'; playerId: PlayerId; points: number }
  // | { type: 'item_spawned'; x: number; y: number }
  // | { type: 'player_died'; playerId: PlayerId };

// IMPORTANT: The type name here must match the import in definition.ts:
//   import type { TemplateEvent } from './events';
//   clientHooks: { onEvent(event: TemplateEvent, state: TemplateState) { ... } }
