import type { BaseGameState, BasePlayer, GameConfig, PlayerId, PlayerColor } from '../../framework/shared/types';
import type { TetrominoType } from './constants';
import type { TetrominoInput } from './input';
import { BOARD_COLS, BOARD_ROWS, TETROMINO_TYPES } from './constants';
import { seededRandom } from '../../framework/shared/utils';

export interface Tetromino {
  type: TetrominoType;
  rotation: number;   // 0–3
  row: number;
  col: number;
}

export interface PlayerBoard extends BasePlayer {
  // Board: BOARD_ROWS × BOARD_COLS, null = empty, string = color hex
  board: (string | null)[][];
  current: Tetromino | null;
  next: TetrominoType;
  held: TetrominoType | null;
  holdUsed: boolean;             // can only hold once per piece
  gravityAccum: number;          // fractional rows accumulated
  lockTimer: number;             // ticks remaining before lock
  lockActive: boolean;
  linesCleared: number;
  level: number;
  dead: boolean;
  pendingGarbage: number;        // garbage lines waiting to be added
  lastAiActionTick: number;      // last tick when AI changed its input
  lastAiInput: TetrominoInput;   // last input provided by AI
}

export interface TetrominoState extends BaseGameState {
  phase: 'playing' | 'game_over';
  players: PlayerBoard[];
  seed: number;                  // deterministic RNG seed base
}

function emptyBoard(): (string | null)[][] {
  return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
}

function pickPiece(seed: number): TetrominoType {
  return TETROMINO_TYPES[Math.floor(seededRandom(seed) * TETROMINO_TYPES.length)];
}

export function createInitialState(config: GameConfig): TetrominoState {
  const seed = Date.now() % 1000000;
  const colors: PlayerColor[] = ['yellow', 'white', 'red', 'blue', 'green', 'orange', 'magenta', 'cyan'];

  const players: PlayerBoard[] = [...config.playerIds, ...config.aiSlots].map((id) => {
    const isAI = config.aiSlots.includes(id);
    const humanIndex = config.playerIds.indexOf(id);
    const name = isAI ? `AI Player ${id}` : config.playerNames[humanIndex];
    const color = (isAI ? colors[id % colors.length] : config.playerColors[humanIndex]) as PlayerColor;

    return {
      id,
      name,
      color,
      score: 0,
      isAI,
      connected: true,
      board: emptyBoard(),
      current: spawnPiece(pickPiece(seed + id * 100)),
      next: pickPiece(seed + id * 100 + 1),
      held: null,
      holdUsed: false,
      gravityAccum: 0,
      lockTimer: 0,
      lockActive: false,
      linesCleared: 0,
      level: 1,
      dead: false,
      pendingGarbage: 0,
      lastAiActionTick: 0,
      lastAiInput: {
        MOVE_LEFT: false,
        MOVE_RIGHT: false,
        SOFT_DROP: false,
        HARD_DROP: false,
        ROTATE_CW: false,
        ROTATE_CCW: false,
        HOLD: false,
      },
    };
  });

  return {
    tick: 0,
    phase: 'playing',
    players,
    seed,
  };
}

export function spawnPiece(type: TetrominoType): Tetromino {
  return { type, rotation: 0, row: 0, col: 3 };
}

export function emptyBoardFn(): (string | null)[][] {
  return emptyBoard();
}

export { pickPiece };
