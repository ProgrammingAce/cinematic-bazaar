import type { TickResult, PlayerId, GameEvent } from '../../framework/shared/types';
import { clamp } from '../../framework/shared/utils';
import type { TemplateState } from './state';
import type { TemplateInput } from './input';
import type { TemplateEvent } from './events';

const SPEED = 200; // pixels per second

// tick() MUST be a pure function: no Math.random(), no I/O, no side effects.
// Use seededRandom(state.tick * 7 + entityId) for deterministic randomness.
// dt is in SECONDS (e.g. ~0.01667 at 60 Hz). Use it for velocity integration: x += vx * dt.
export function tick(
  state: TemplateState,
  inputs: Map<PlayerId, TemplateInput>,
  dt: number,
): TickResult<TemplateState> {
  const next: TemplateState = {
    ...state,
    tick: state.tick + 1,
    timeRemaining: Math.max(0, state.timeRemaining - dt),
    players: state.players.map(p => ({ ...p })),
  };

  for (const player of next.players) {
    const inp = inputs.get(player.id) ?? {} as TemplateInput;
    let vx = 0, vy = 0;
    if (inp.MOVE_LEFT)  vx -= SPEED;
    if (inp.MOVE_RIGHT) vx += SPEED;
    if (inp.MOVE_UP)    vy -= SPEED;
    if (inp.MOVE_DOWN)  vy += SPEED;
    player.x = clamp(player.x + vx * dt, 0, 800);
    player.y = clamp(player.y + vy * dt, 0, 600);
    // TODO: collision, scoring, game-specific logic
  }

  if (next.timeRemaining <= 0) next.phase = 'game_over';

  // Emit events to clients (broadcast with state each tick).
  // Events are typed in events.ts and reacted to in definition.ts clientHooks.onEvent.
  const events: GameEvent[] = [];
  // if (somethingHappened) events.push({ type: 'player_scored', playerId: 0, points: 1 });

  return { state: next, events };
}

export function isGameOver(state: TemplateState): boolean {
  return state.phase === 'game_over';
  // TODO: add other end conditions (e.g. one player remaining)
}

export function getWinner(state: TemplateState): PlayerId | null {
  if (state.players.length === 1) return state.players[0].id;
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  if (sorted[0].score === sorted[1].score) return null;
  return sorted[0].id;
}
