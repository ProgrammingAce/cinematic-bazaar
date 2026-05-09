import type { GameRenderer, PlayerId } from '../../framework/shared/types';
import { PLAYER_COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from '../../framework/shared/constants';
import type { TemplateState } from './state';

// renderer.render() is called every animation frame (~60 Hz) by the framework.
// The framework fills the canvas with black before each call.
// Canvas origin (0,0) is top-left; X right, Y down.
export const renderer: GameRenderer<TemplateState> = {
  render(ctx: CanvasRenderingContext2D, state: TemplateState, myPlayerId: PlayerId): void {
    // TODO: draw world/background

    for (const player of state.players) {
      const color = PLAYER_COLORS[player.id];
      ctx.fillStyle = color;
      ctx.fillRect(player.x - 16, player.y - 16, 32, 32); // TODO: replace placeholder square

      // Player name label
      ctx.fillStyle = '#fff';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, player.x, player.y - 22);
      ctx.textAlign = 'left';
    }

    // HUD: time remaining
    ctx.fillStyle = '#aaa';
    ctx.font = '13px monospace';
    ctx.fillText(`Time: ${Math.ceil(state.timeRemaining)}s`, 8, 18);

    // Game over overlay
    if (state.phase === 'game_over') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.textAlign = 'left';
    }
  },
};
