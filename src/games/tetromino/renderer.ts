import type { GameRenderer, PlayerId } from '../../framework/shared/types';
import type { TetrominoState, PlayerBoard, Tetromino } from './state';
import { BOARD_COLS, BOARD_ROWS, TETROMINO_SHAPES, TETROMINO_COLORS } from './constants';
import { PLAYER_COLORS } from '../../framework/shared/constants';

// Layout: 4 panels in a 2×2 grid on 800×600
const CELL = 18;
const BOARD_W = BOARD_COLS * CELL;  // 180
const BOARD_H = BOARD_ROWS * CELL;  // 360
const MARGIN = 10;
const PANEL_W = BOARD_W + 60;  // extra for hold/next/score
const PANEL_H = BOARD_H + 40; // label + board

// Panel top-left positions (2×2 grid, centered)
const PANEL_POSITIONS = [
  { x: 20,  y: 20  },
  { x: 420, y: 20  },
  { x: 20,  y: 330 },
  { x: 420, y: 330 },
];

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number = CELL): void {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x + 1, y + 1, size - 2, 3);
  ctx.fillRect(x + 1, y + 1, 3, size - 2);
}

function drawBoard(ctx: CanvasRenderingContext2D, ox: number, oy: number, board: (string | null)[][]): void {
  // Background
  ctx.fillStyle = '#111';
  ctx.fillRect(ox, oy, BOARD_W, BOARD_H);

  // Grid lines
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= BOARD_ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(ox, oy + r * CELL); ctx.lineTo(ox + BOARD_W, oy + r * CELL); ctx.stroke();
  }
  for (let c = 0; c <= BOARD_COLS; c++) {
    ctx.beginPath(); ctx.moveTo(ox + c * CELL, oy); ctx.lineTo(ox + c * CELL, oy + BOARD_H); ctx.stroke();
  }

  // Cells
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const color = board[r][c];
      if (color) drawCell(ctx, ox + c * CELL, oy + r * CELL, color);
    }
  }
}

function drawPiece(ctx: CanvasRenderingContext2D, ox: number, oy: number, piece: Tetromino, alpha = 1): void {
  ctx.globalAlpha = alpha;
  const color = TETROMINO_COLORS[piece.type];
  for (const [r, c] of TETROMINO_SHAPES[piece.type][piece.rotation]) {
    const pr = piece.row + r;
    const pc = piece.col + c;
    if (pr >= 0 && pr < BOARD_ROWS && pc >= 0 && pc < BOARD_COLS) {
      drawCell(ctx, ox + pc * CELL, oy + pr * CELL, color);
    }
  }
  ctx.globalAlpha = 1;
}

function drawGhost(ctx: CanvasRenderingContext2D, ox: number, oy: number, board: (string | null)[][], piece: Tetromino): void {
  let ghostRow = piece.row;
  while (true) {
    const next = { ...piece, row: ghostRow + 1 };
    let valid = true;
    for (const [r, c] of TETROMINO_SHAPES[next.type][next.rotation]) {
      const nr = next.row + r;
      const nc = next.col + c;
      if (nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS || board[nr]?.[nc]) { valid = false; break; }
    }
    if (!valid) break;
    ghostRow++;
  }
  if (ghostRow === piece.row) return;
  const ghost = { ...piece, row: ghostRow };
  drawPiece(ctx, ox, oy, ghost, 0.25);
}

function drawMini(ctx: CanvasRenderingContext2D, cx: number, cy: number, type: string | null): void {
  if (!type) return;
  const t = type as keyof typeof TETROMINO_COLORS;
  const color = TETROMINO_COLORS[t];
  const cells = TETROMINO_SHAPES[t][0];
  const miniSize = 10;
  for (const [r, c] of cells) {
    drawCell(ctx, cx + c * miniSize, cy + r * miniSize, color, miniSize);
  }
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  player: PlayerBoard,
  px: number,
  py: number,
  isMe: boolean,
): void {
  const ox = px;
  const oy = py + 22; // space for label

  // Player label
  ctx.fillStyle = PLAYER_COLORS[player.id];
  ctx.font = `bold 13px monospace`;
  ctx.fillText(`${player.name} L${player.level}`, px, py + 14);

  // Score
  ctx.fillStyle = '#aaa';
  ctx.font = '11px monospace';
  ctx.fillText(`${player.score}`, px + BOARD_W + 4, py + 14);

  if (player.dead) {
    drawBoard(ctx, ox, oy, player.board);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(ox, oy, BOARD_W, BOARD_H);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DEAD', ox + BOARD_W / 2, oy + BOARD_H / 2);
    ctx.textAlign = 'left';
    return;
  }

  drawBoard(ctx, ox, oy, player.board);

  if (player.current) {
    drawGhost(ctx, ox, oy, player.board, player.current);
    drawPiece(ctx, ox, oy, player.current);
  }

  // Next piece preview
  const nextX = ox + BOARD_W + 4;
  ctx.fillStyle = '#555';
  ctx.font = '9px monospace';
  ctx.fillText('NEXT', nextX, oy + 10);
  drawMini(ctx, nextX, oy + 14, player.next);

  // Hold piece
  ctx.fillText('HOLD', nextX, oy + 70);
  drawMini(ctx, nextX, oy + 74, player.held ?? null);

  // Pending garbage indicator
  if (player.pendingGarbage > 0) {
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(ox + BOARD_W - 6, oy + BOARD_H - player.pendingGarbage * CELL, 5, player.pendingGarbage * CELL);
  }

  // "ME" badge
  if (isMe) {
    ctx.fillStyle = 'rgba(255,255,0,0.8)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('YOU', ox + BOARD_W - 28, oy - 6);
  }
}

export const renderer: GameRenderer<TetrominoState> = {
  render(ctx: CanvasRenderingContext2D, state: TetrominoState, myPlayerId: PlayerId): void {
    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 800, 600);

    for (let i = 0; i < state.players.length && i < 4; i++) {
      const player = state.players[i];
      const pos = PANEL_POSITIONS[i];
      drawPanel(ctx, player, pos.x, pos.y, player.id === myPlayerId);
    }

    // Game over overlay
    if (state.phase === 'game_over') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', 400, 290);
      ctx.textAlign = 'left';
    }
  },
};
