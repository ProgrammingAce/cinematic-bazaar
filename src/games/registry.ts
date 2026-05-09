/**
 * Central game registry — the ONLY file that needs to change when adding a new game.
 *
 * Steps:
 *   1. Create src/games/<id>/ following the template in src/games/_template/
 *   2. Import your definition below and add it to GAMES.
 *   3. Run `npm run build` — both server and client bundles pick it up automatically.
 */
import type { GameDefinition } from '../framework/shared/types';
import tetrominoGame from './tetromino/definition';
import warlordsGame from './warlords/definition';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: GameDefinition<any, any>[] = [
  tetrominoGame,
  warlordsGame,
  // Add new games here ↓
];
