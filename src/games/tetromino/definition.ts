import type { GameDefinition } from '../../framework/shared/types';
import { createInitialState } from './state';
import { tick, isGameOver, getWinner, aiAdapter } from './engine';
import { actions, defaultActionMap } from './input';
import { renderer } from './renderer';
import type { TetrominoState } from './state';
import type { TetrominoInput } from './input';

const definition: GameDefinition<TetrominoState, TetrominoInput> = {
  id: 'tetromino',
  name: 'Tetromino Battle',
  description: 'Competitive 4-player Tetris — clear lines to send garbage to your opponents.',
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
    <h3>Controls</h3>
    <ul>
      <li>← → Arrow keys / A D — Move</li>
      <li>↑ Arrow / W — Rotate clockwise</li>
      <li>Z — Rotate counter-clockwise</li>
      <li>↓ Arrow / S — Soft drop</li>
      <li>Space — Hard drop</li>
      <li>Shift / C — Hold piece</li>
    </ul>
    <h3>Rules</h3>
    <p>Clear 2+ lines at once to send garbage lines to all other players.
    Last player standing wins. If you fill your board to the top, you're out!</p>
    <h3>Garbage</h3>
    <ul>
      <li>2 lines → 1 garbage line sent</li>
      <li>3 lines → 2 garbage lines sent</li>
      <li>4 lines (Tetris) → 4 garbage lines sent</li>
    </ul>
  `,
  settings: [
    {
      key: 'startLevel',
      label: 'Starting Level',
      type: 'range',
      default: 1,
      min: 1,
      max: 15,
      step: 1,
    },
  ],
  clientHooks: {
    onEvent(event) {
      // Future: play sounds
      if (event.type === 'lines_cleared') {
        const count = event.count as number;
        if (count >= 4) console.log('TETRIS!');
      }
    },
  },
};

export default definition;
