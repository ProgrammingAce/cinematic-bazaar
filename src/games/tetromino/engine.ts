import type { TickResult, PlayerId } from '../../framework/shared/types';
import type { TetrominoState, PlayerBoard, Tetromino } from './state';
import type { TetrominoInput } from './input';
import type { TetrominoType } from './constants';
import {
  BOARD_COLS, BOARD_ROWS, TETROMINO_SHAPES, TETROMINO_COLORS,
  BASE_GRAVITY, GRAVITY_INCREMENT, LINE_POINTS, GARBAGE_PER_LINE,
  LOCK_DELAY_TICKS, TETROMINO_TYPES,
} from './constants';
import { spawnPiece, emptyBoardFn, pickPiece } from './state';
import { seededRandom } from '../../framework/shared/utils';
import type { TetrominoEvent } from './events';

function getCells(t: Tetromino): [number, number][] {
  return TETROMINO_SHAPES[t.type][t.rotation].map(([r, c]) => [t.row + r, t.col + c]);
}

function isValid(board: (string | null)[][], t: Tetromino): boolean {
  for (const [r, c] of getCells(t)) {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return false;
    if (board[r][c] !== null) return false;
  }
  return true;
}

function lockPiece(board: (string | null)[][], t: Tetromino): void {
  const color = TETROMINO_COLORS[t.type];
  for (const [r, c] of getCells(t)) {
    if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
      board[r][c] = color;
    }
  }
}

function clearLines(board: (string | null)[][]): number {
  const kept = board.filter(row => row.some(cell => cell === null));
  const cleared = BOARD_ROWS - kept.length;
  while (kept.length < BOARD_ROWS) kept.unshift(Array(BOARD_COLS).fill(null));
  board.splice(0, BOARD_ROWS, ...kept);
  return cleared;
}

function addGarbageLines(board: (string | null)[][], count: number, seed: number): void {
  const gapCol = Math.floor(seededRandom(seed) * BOARD_COLS);
  for (let i = 0; i < count; i++) {
    board.shift();
    const garbageLine = Array(BOARD_COLS).fill('#555555');
    garbageLine[gapCol] = null;
    board.push(garbageLine);
  }
}

function hardDropRow(board: (string | null)[][], t: Tetromino): number {
  let piece = { ...t };
  while (isValid(board, { ...piece, row: piece.row + 1 })) piece.row++;
  return piece.row;
}

function tryRotate(board: (string | null)[][], t: Tetromino, dir: 1 | -1): Tetromino | null {
  const newRot = ((t.rotation + dir + 4) % 4) as 0 | 1 | 2 | 3;
  const candidate = { ...t, rotation: newRot };
  // Wall kick offsets: try 0, ±1, ±2 horizontal
  for (const dc of [0, -1, 1, -2, 2]) {
    const kicked = { ...candidate, col: candidate.col + dc };
    if (isValid(board, kicked)) return kicked;
  }
  return null;
}

function nextPieceSeed(state: TetrominoState, playerId: PlayerId, pieceIndex: number): number {
  return state.seed + playerId * 10000 + pieceIndex;
}

export function tick(
  state: TetrominoState,
  inputs: Map<PlayerId, TetrominoInput>,
  dt: number,
): TickResult<TetrominoState> {
  // Deep clone only what we mutate
  const next: TetrominoState = {
    ...state,
    tick: state.tick + 1,
    players: state.players.map(p => ({
      ...p,
      board: p.board.map(row => [...row]),
      current: p.current ? { ...p.current } : null,
    })),
  };

  const events: TetrominoEvent[] = [];
  const garbageToSend = new Map<PlayerId, number>(); // pid → lines to send

  let activePlayers = next.players.filter(p => !p.dead);

  for (const player of activePlayers) {
    if (player.current === null) continue;

    const inp = inputs.get(player.id) ?? {} as TetrominoInput;

    if (player.isAI) {
      const changed = 
        inp.MOVE_LEFT !== player.lastAiInput.MOVE_LEFT ||
        inp.MOVE_RIGHT !== player.lastAiInput.MOVE_RIGHT ||
        inp.SOFT_DROP !== player.lastAiInput.SOFT_DROP ||
        inp.HARD_DROP !== player.lastAiInput.HARD_DROP ||
        inp.ROTATE_CW !== player.lastAiInput.ROTATE_CW ||
        inp.ROTATE_CCW !== player.lastAiInput.ROTATE_CCW ||
        inp.HOLD !== player.lastAiInput.HOLD;
      if (changed) {
        player.lastAiActionTick = state.tick;
        player.lastAiInput = { ...inp };
      }
    }

    const board = player.board;
    let piece = { ...player.current };

    // --- Apply pending garbage before this piece ---
    if (player.pendingGarbage > 0) {
      addGarbageLines(board, player.pendingGarbage, state.tick + player.id);
      player.pendingGarbage = 0;
    }

    // --- Input handling ---
    if (inp.HOLD && !player.holdUsed) {
      player.holdUsed = true;
      const swapType = player.held ?? player.next;
      player.held = piece.type;
      if (!player.held) { /* already set */ }
      const newNext = player.held === player.next ? pickNextPiece(state, player, next.tick) : player.next;
      if (player.held === player.next) player.next = newNext;
      piece = spawnPiece(swapType);
      player.lockActive = false;
      player.lockTimer = 0;
      if (!isValid(board, piece)) { player.dead = true; continue; }
    }

    if (inp.ROTATE_CW) {
      const rotated = tryRotate(board, piece, 1);
      if (rotated) { piece = rotated; player.lockTimer = LOCK_DELAY_TICKS; }
    }
    if (inp.ROTATE_CCW) {
      const rotated = tryRotate(board, piece, -1);
      if (rotated) { piece = rotated; player.lockTimer = LOCK_DELAY_TICKS; }
    }

    if (inp.MOVE_LEFT) {
      const moved = { ...piece, col: piece.col - 1 };
      if (isValid(board, moved)) { piece = moved; player.lockTimer = LOCK_DELAY_TICKS; }
    }
    if (inp.MOVE_RIGHT) {
      const moved = { ...piece, col: piece.col + 1 };
      if (isValid(board, moved)) { piece = moved; player.lockTimer = LOCK_DELAY_TICKS; }
    }

    if (inp.HARD_DROP) {
      piece.row = hardDropRow(board, piece);
      lockPiece(board, piece);
      const cleared = clearLines(board);
      player.linesCleared += cleared;
      player.score += LINE_POINTS[cleared] * player.level;
      player.level = Math.floor(player.linesCleared / 10) + 1;

      const garbage = GARBAGE_PER_LINE[cleared];
      if (garbage > 0) garbageToSend.set(player.id, (garbageToSend.get(player.id) ?? 0) + garbage);

      if (cleared > 0) events.push({ type: 'lines_cleared', playerId: player.id, count: cleared });

      // Spawn next
      piece = spawnPiece(player.next);
      player.next = pickNextPiece(state, player, next.tick);
      player.holdUsed = false;
      player.lockActive = false;
      player.lockTimer = 0;
      player.gravityAccum = 0;

      if (!isValid(board, piece)) { player.dead = true; events.push({ type: 'player_dead', playerId: player.id }); player.current = null; continue; }
      player.current = piece;
      continue;
    }

    // --- Gravity ---
    const gravitySpeed = BASE_GRAVITY + (player.level - 1) * GRAVITY_INCREMENT;
    const softMult = inp.SOFT_DROP ? 10 : 1;
    player.gravityAccum += gravitySpeed * softMult * dt;

    let dropped = false;
    while (player.gravityAccum >= 1) {
      player.gravityAccum -= 1;
      const fallen = { ...piece, row: piece.row + 1 };
      if (isValid(board, fallen)) {
        piece = fallen;
        dropped = true;
      } else {
        player.gravityAccum = 0;
        break;
      }
    }

    // --- Lock delay ---
    const onGround = !isValid(board, { ...piece, row: piece.row + 1 });
    if (onGround) {
      if (!player.lockActive) {
        player.lockActive = true;
        player.lockTimer = LOCK_DELAY_TICKS;
      } else {
        player.lockTimer--;
      }

      if (player.lockTimer <= 0) {
        lockPiece(board, piece);
        const cleared = clearLines(board);
        player.linesCleared += cleared;
        player.score += LINE_POINTS[cleared] * player.level;
        player.level = Math.floor(player.linesCleared / 10) + 1;

        const garbage = GARBAGE_PER_LINE[cleared];
        if (garbage > 0) garbageToSend.set(player.id, (garbageToSend.get(player.id) ?? 0) + garbage);

        if (cleared > 0) events.push({ type: 'lines_cleared', playerId: player.id, count: cleared });

        piece = spawnPiece(player.next);
        player.next = pickNextPiece(state, player, next.tick);
        player.holdUsed = false;
        player.lockActive = false;
        player.lockTimer = 0;
        player.gravityAccum = 0;

        if (!isValid(board, piece)) { player.dead = true; events.push({ type: 'player_dead', playerId: player.id }); player.current = null; continue; }
      }
    } else {
      player.lockActive = false;
    }

    player.current = piece;
  }

  // Distribute garbage from each sender to all alive opponents (round-robin)
  activePlayers = next.players.filter(p => !p.dead);
  for (const [senderId, garbageCount] of garbageToSend) {
    const targets = next.players.filter(p => p.id !== senderId && !p.dead);
    if (targets.length === 0) continue;
    const perTarget = Math.floor(garbageCount / targets.length);
    const extra = garbageCount % targets.length;
    for (let i = 0; i < targets.length; i++) {
      targets[i].pendingGarbage += perTarget + (i === 0 ? extra : 0);
    }
  }

  // Mark game over in state so the renderer can show the overlay immediately
  const aliveAfter = next.players.filter(p => !p.dead);
  const gameEnded = next.players.length === 1 ? aliveAfter.length === 0 : aliveAfter.length <= 1;
  if (gameEnded) next.phase = 'game_over';

  return { state: next, events };
}

function pickNextPiece(state: TetrominoState, player: PlayerBoard, currentTick: number): TetrominoType {
  const seed = state.seed + player.id * 10000 + currentTick;
  return TETROMINO_TYPES[Math.floor(seededRandom(seed) * TETROMINO_TYPES.length)];
}

export function isGameOver(state: TetrominoState): boolean {
  if (state.phase === 'game_over') return true;
  const alive = state.players.filter(p => !p.dead);
  // Game over when 0 or 1 players remain alive (or if all dead in 1-player)
  if (state.players.length === 1) return alive.length === 0;
  return alive.length <= 1;
}

export function getWinner(state: TetrominoState): PlayerId | null {
  const alive = state.players.filter(p => !p.dead);
  if (alive.length === 1) return alive[0].id;
  // If all dead simultaneously, highest score wins
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  if (sorted[0].score === sorted[1]?.score) return null;
  return sorted[0].id;
}

// AI: make simple moves — move toward valid drop position, rotate randomly
export const aiAdapter = {
  computeInput(state: TetrominoState, playerId: PlayerId): TetrominoInput {
    const player = state.players.find(p => p.id === playerId);
    const inp: TetrominoInput = {
      MOVE_LEFT: false, MOVE_RIGHT: false, SOFT_DROP: false,
      HARD_DROP: false, ROTATE_CW: false, ROTATE_CCW: false, HOLD: false,
    };
    if (!player || !player.current || player.dead) return inp;

    const piece = player.current;
    const board = player.board;

    let bestScore = Infinity;
    let bestCol = piece.col;
    let bestRot = piece.rotation;

    for (let rot = 0; rot < 4; rot++) {
      const candidate = { ...piece, rotation: rot };
      for (let col = 0; col < BOARD_COLS; col++) {
        const placed = { ...candidate, col };
        if (!isValid(board, placed)) continue;
        const dropped = { ...placed, row: hardDropRow(board, placed) };
        const score = evalBoard(board, dropped);
        if (score < bestScore) { bestScore = score; bestCol = col; bestRot = rot; }
      }
    }

    // Apply one action per tick toward goal
    if (bestRot !== piece.rotation) {
      inp.ROTATE_CW = true;
    } else if (bestCol < piece.col) {
      inp.MOVE_LEFT = true;
    } else if (bestCol > piece.col) {
      inp.MOVE_RIGHT = true;
    } else {
      inp.HARD_DROP = true;
    }

    return inp;
  },
};

function evalBoard(board: (string | null)[][], piece: Tetromino): number {
  const scratch = board.map(r => [...r]);
  const color = TETROMINO_COLORS[piece.type];
  for (const [r, c] of TETROMINO_SHAPES[piece.type][piece.rotation].map(([r2, c2]) => [piece.row + r2, piece.col + c2])) {
    if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) scratch[r][c] = color;
  }

  let aggregateHeight = 0;
  let holes = 0;
  let bumpiness = 0;
  const heights: number[] = [];

  for (let c = 0; c < BOARD_COLS; c++) {
    let h = 0;
    for (let r = 0; r < BOARD_ROWS; r++) {
      if (scratch[r][c] !== null) { h = BOARD_ROWS - r; break; }
    }
    heights.push(h);
    aggregateHeight += h;
    let inBlock = false;
    for (let r = 0; r < BOARD_ROWS; r++) {
      if (scratch[r][c] !== null) inBlock = true;
      else if (inBlock) holes++;
    }
  }

  for (let c = 0; c < BOARD_COLS - 1; c++) bumpiness += Math.abs(heights[c] - heights[c + 1]);

  const completedLines = scratch.filter(row => row.every(cell => cell !== null)).length;

  return aggregateHeight * 0.51 + holes * 0.75 + bumpiness * 0.35 - completedLines * 3.0;
}
