import type { GameDefinition } from '../../framework/shared/types';
import { createInitialState } from './state';
import { tick, isGameOver, getWinner, aiAdapter } from './engine';
import { actions, defaultActionMap } from './input';
import { renderer } from './renderer';
import type { WarlordsState } from './state';
import type { WarlordsInput } from './input';
import { GAME_SETTINGS } from './constants';

const definition: GameDefinition<WarlordsState, WarlordsInput> = {
  id: 'warlords',
  name: 'Warlords',
  description: 'Destroy enemy castles and warlords in this classic arcade shooter.',
  minPlayers: 1,
  maxPlayers: 4,
  actions,
  defaultActionMap,
  createInitialState,
  tick,
  isGameOver,
  getWinner,
  renderer,
  aiAdapter,
  howToPlay: `
    <h3>Objective</h3>
    <p>Destroy the enemy warlord (crown) in the center of each castle.
    The first player to win the required number of battles wins the war.</p>
    <h3>Controls</h3>
    <ul>
      <li>Arrow Left / A — Rotate shield counter-clockwise</li>
      <li>Arrow Right / D — Rotate shield clockwise</li>
      <li>Mouse Wheel — Rotate shield</li>
    </ul>
    <h3>Gameplay</h3>
    <p>Each battle begins with a dragon launching a fireball.
    Deflect fireballs with your rotating shield.
    Destroy the enemy castle bricks to expose the warlord.
    Hit the exposed warlord to win the battle.
    Your dead warlord launches a retaliatory fireball.</p>
    <h3>Shields</h3>
    <p>Each player has a shield that orbits their castle.
    Use it to ricochet fireballs toward other players.</p>
  `,
  settings: GAME_SETTINGS,
  clientHooks: {
    onEvent(event, state) {
      // Future: play sounds
      if (event.type === 'brick_destroyed') {
        // brick destroyed sound
      } else if (event.type === 'warlord_dead') {
        // warlord dead sound
      } else if (event.type === 'battle_won') {
        // battle won sound
      } else if (event.type === 'war_won') {
        // war won sound
      } else if (event.type === 'shield_hit') {
        // shield hit sound
      }
    },
  },
};

export default definition;
