import type { GameDefinition } from '../../framework/shared/types';
import { createInitialState } from './state';
import { tick, isGameOver, getWinner } from './engine';
import { actions, defaultActionMap } from './input';
import { renderer } from './renderer';
import type { TemplateState } from './state';
import type { TemplateInput } from './input';

// Rename everything from "template" / "Template" to your game's name,
// then add this game to src/games/registry.ts.
const definition: GameDefinition<TemplateState, TemplateInput> = {
  id: 'template',           // TODO: unique slug, e.g. "snake" or "warlords"
  name: 'Template Game',    // TODO: display name shown in the main menu
  description: 'TODO: one-sentence description shown under the title.',
  minPlayers: 1,            // 1 = allows solo play
  maxPlayers: 4,            // 2–8 inclusive
  actions,
  defaultActionMap,
  createInitialState,
  tick,
  isGameOver,
  getWinner,
  renderer,
  howToPlay: `
    <h3>Objective</h3>
    <p>TODO: explain the win condition.</p>
    <h3>Controls</h3>
    <ul>
      <li>Arrow keys / WASD — Move</li>
      <li>Space / E — Action</li>
    </ul>
  `,
  settings: [
    // TODO: add lobby-configurable settings, or remove this field entirely.
    // { key: 'gameDuration', label: 'Duration (s)', type: 'range', default: 120, min: 30, max: 300, step: 30 },
  ],
  // aiAdapter: { computeInput(state, playerId) { return {} as TemplateInput; } },
  // clientHooks: { onEvent(event, state) { /* play sounds, trigger particles */ } },
};

export default definition;
