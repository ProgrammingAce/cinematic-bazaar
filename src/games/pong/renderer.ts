import type { GameRenderer, PlayerId } from '../../framework/shared/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_COLORS } from '../../framework/shared/constants';
import type { PongState } from './state';
import { PADDLE_WIDTH, PADDLE_HEIGHT, BALL_SIZE, PADDLE_X, WIN_SCORE } from './constants';

export const renderer: GameRenderer<PongState> = {
  render(ctx: CanvasRenderingContext2D, state: PongState, myPlayerId: PlayerId): void {
    const p0 = state.players[0];
    const p1 = state.players[1];

    // Center divider
    ctx.setLineDash([10, 14]);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scores
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    if (p0) ctx.fillText(String(p0.score), CANVAS_WIDTH / 2 - 80, 80);
    if (p1) ctx.fillText(String(p1.score), CANVAS_WIDTH / 2 + 80, 80);

    // Win score indicator (small dots)
    const dotY = 95;
    const dotSize = 5;
    const dotGap = 13;
    for (let i = 0; i < WIN_SCORE; i++) {
      const filled0 = p0 && i < p0.score;
      const filled1 = p1 && i < p1.score;
      const baseX0 = CANVAS_WIDTH / 2 - 50 - (WIN_SCORE - 1) * dotGap / 2;
      const baseX1 = CANVAS_WIDTH / 2 + 50 - (WIN_SCORE - 1) * dotGap / 2;

      ctx.fillStyle = filled0 ? PLAYER_COLORS[p0.id] : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(baseX0 + i * dotGap, dotY, dotSize / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = filled1 ? PLAYER_COLORS[p1.id] : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(baseX1 + i * dotGap, dotY, dotSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Left paddle (player 0)
    if (p0) {
      const isMe = p0.id === myPlayerId;
      const color = PLAYER_COLORS[p0.id];
      ctx.fillStyle = isMe ? lighten(color, 0.3) : color;
      ctx.shadowColor = isMe ? color : 'transparent';
      ctx.shadowBlur = isMe ? 8 : 0;
      ctx.fillRect(
        PADDLE_X - PADDLE_WIDTH / 2,
        p0.paddleY - PADDLE_HEIGHT / 2,
        PADDLE_WIDTH,
        PADDLE_HEIGHT,
      );
    }

    // Right paddle (player 1)
    if (p1) {
      const isMe = p1.id === myPlayerId;
      const color = PLAYER_COLORS[p1.id];
      ctx.fillStyle = isMe ? lighten(color, 0.3) : color;
      ctx.shadowColor = isMe ? color : 'transparent';
      ctx.shadowBlur = isMe ? 8 : 0;
      ctx.fillRect(
        CANVAS_WIDTH - PADDLE_X - PADDLE_WIDTH / 2,
        p1.paddleY - PADDLE_HEIGHT / 2,
        PADDLE_WIDTH,
        PADDLE_HEIGHT,
      );
    }

    ctx.shadowBlur = 0;

    // Ball
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.fillRect(
      state.ball.x - BALL_SIZE / 2,
      state.ball.y - BALL_SIZE / 2,
      BALL_SIZE,
      BALL_SIZE,
    );
    ctx.shadowBlur = 0;

    // Player name labels
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    if (p0) {
      ctx.textAlign = 'left';
      ctx.fillText(p0.name + (p0.isAI ? ' [AI]' : ''), PADDLE_X + PADDLE_WIDTH / 2 + 6, CANVAS_HEIGHT - 8);
    }
    if (p1) {
      ctx.textAlign = 'right';
      ctx.fillText(p1.name + (p1.isAI ? ' [AI]' : ''), CANVAS_WIDTH - PADDLE_X - PADDLE_WIDTH / 2 - 6, CANVAS_HEIGHT - 8);
    }
    ctx.textAlign = 'left';

    // Game over overlay
    if (state.phase === 'game_over') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const winner = state.players.reduce((a, b) => (a.score > b.score ? a : b), state.players[0]);
      const isWinner = winner?.id === myPlayerId;
      const winColor = winner ? PLAYER_COLORS[winner.id] : '#ffffff';

      ctx.font = 'bold 52px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = isWinner ? winColor : '#ffffff';
      ctx.fillText(isWinner ? 'YOU WIN!' : 'GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

      if (winner) {
        ctx.font = '22px monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`${winner.name} wins ${winner.score}–${state.players.find(p => p.id !== winner.id)?.score ?? 0}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 28);
      }
      ctx.textAlign = 'left';
    }
  },
};

// Lighten a hex color by a factor (0..1). Used to highlight the local player's paddle.
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}
