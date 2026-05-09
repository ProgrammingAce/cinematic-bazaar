import type { GameRenderer, PlayerId } from '../../framework/shared/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../framework/shared/constants';
import type { WarlordsState, WarlordsPlayer } from './state';
import {
  CASTLE_SIZE, BRICK_WIDTH, BRICK_HEIGHT, FIREBALL_RADIUS,
  SHIELD_WIDTH, SHIELD_HEIGHT, CASTLE_POSITIONS,
  getShieldPosition,
} from './constants';

function getPlayerColor(color: string, variant: string): string {
  const colorMap: Record<string, Record<string, string>> = {
    yellow: { castle: '#ffff00', 'castle-dim': '#aaaa00', shield: '#ffff00', warlord: '#ffff00' },
    white:  { castle: '#ffffff', 'castle-dim': '#aaaaaa', shield: '#ffffff', warlord: '#ffffff' },
    red:    { castle: '#ff4444', 'castle-dim': '#aa2222', shield: '#ff4444', warlord: '#ff4444' },
    blue:   { castle: '#4488ff', 'castle-dim': '#2244aa', shield: '#4488ff', warlord: '#4488ff' },
    green:  { castle: '#44ff88', 'castle-dim': '#22aa44', shield: '#44ff88', warlord: '#44ff88' },
    orange: { castle: '#ff8844', 'castle-dim': '#aa4422', shield: '#ff8844', warlord: '#ff8844' },
    magenta:{ castle: '#ff44ff', 'castle-dim': '#aa22aa', shield: '#ff44ff', warlord: '#ff44ff' },
    cyan:   { castle: '#44ffff', 'castle-dim': '#22aaaa', shield: '#44ffff', warlord: '#44ffff' },
  };
  return (colorMap[color]?.[variant] || '#ffffff');
}

function getWarlordPosition(player: WarlordsPlayer): { x: number; y: number } {
  const pos = CASTLE_POSITIONS[player.id];
  return {
    x: pos.x + (BRICK_WIDTH * 6) / 2,
    y: pos.y + (BRICK_HEIGHT * 6) / 2,
  };
}

export const renderer: GameRenderer<WarlordsState> = {
  render(ctx: CanvasRenderingContext2D, state: WarlordsState, myPlayerId: PlayerId): void {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, CANVAS_WIDTH - 40, CANVAS_HEIGHT - 40);
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 20);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20);
    ctx.moveTo(20, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH - 20, CANVAS_HEIGHT / 2);
    ctx.stroke();

    // Castles
    for (const player of state.players) {
      for (const brick of player.castle.bricks) {
        if (brick.hp <= 0) continue;
        ctx.fillStyle = brick.hp === 2
          ? getPlayerColor(player.color, 'castle')
          : getPlayerColor(player.color, 'castle-dim');
        ctx.fillRect(brick.x, brick.y, BRICK_WIDTH, BRICK_HEIGHT);
      }
    }

    // Warlords (crowns)
    for (const player of state.players) {
      if (!player.alive) continue;
      const pos = getWarlordPosition(player);
      const cx = pos.x;
      const cy = pos.y;
      const w = 10;
      const h = 8;
      ctx.fillStyle = getPlayerColor(player.color, 'castle-dim');
      ctx.beginPath();
      ctx.moveTo(cx - w, cy + h);
      ctx.lineTo(cx - w, cy - h / 2);
      ctx.lineTo(cx - w / 2, cy - h / 2);
      ctx.lineTo(cx - w / 4, cy - h);
      ctx.lineTo(cx, cy - h / 2);
      ctx.lineTo(cx + w / 4, cy - h);
      ctx.lineTo(cx + w / 2, cy - h / 2);
      ctx.lineTo(cx + w, cy - h / 2);
      ctx.lineTo(cx + w, cy + h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Ghosts
    for (const player of state.players) {
      if (!player.ghostActive) continue;
      const alpha = 0.3 + Math.sin(player.ghostTimer * 0.1) * 0.2;
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
      ctx.beginPath();
      ctx.arc(player.ghostX, player.ghostY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(player.ghostX - 4, player.ghostY - 2, 2, 0, Math.PI * 2);
      ctx.arc(player.ghostX + 4, player.ghostY - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Balls
    for (const ball of state.balls) {
      const gradient = ctx.createRadialGradient(
        ball.x, ball.y, 0,
        ball.x, ball.y, FIREBALL_RADIUS * 2
      );
      gradient.addColorStop(0, '#ff8800');
      gradient.addColorStop(0.5, '#ff4400');
      gradient.addColorStop(1, 'rgba(255, 68, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, FIREBALL_RADIUS * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, FIREBALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, FIREBALL_RADIUS - 1, ball.spin, ball.spin + Math.PI);
      ctx.stroke();
    }

    // Shields
    for (const player of state.players) {
      if (!player.alive) continue;
      const sp = getShieldPosition(player.shield.angle, player.id);
      const { x, y, angle } = sp;
      ctx.fillStyle = getPlayerColor(player.color, 'shield');
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillRect(-SHIELD_WIDTH / 2, -SHIELD_HEIGHT / 2, SHIELD_WIDTH, SHIELD_HEIGHT);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(-SHIELD_WIDTH / 2, -SHIELD_HEIGHT / 2, SHIELD_WIDTH, SHIELD_HEIGHT);
      ctx.restore();
    }

    // Dragon
    if (state.phase === 'dragon') {
      const dx = state.dragonX;
      const dy = state.dragonY;
      ctx.fillStyle = '#8800ff';
      ctx.beginPath();
      ctx.moveTo(dx, dy - 12);
      ctx.lineTo(dx + 12, dy + 8);
      ctx.lineTo(dx + 6, dy + 8);
      ctx.lineTo(dx + 6, dy + 12);
      ctx.lineTo(dx - 6, dy + 12);
      ctx.lineTo(dx - 6, dy + 8);
      ctx.lineTo(dx - 12, dy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(dx - 4, dy, 2, 0, Math.PI * 2);
      ctx.arc(dx + 4, dy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DRAGON', dx, dy + 24);
    }

    // HUD
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 30);

    const numPlayers = state.players.length;
    const colors: Record<number, string> = {
      0: '#ffff00', 1: '#ffffff', 2: '#ff4444', 3: '#4488ff',
      4: '#44ff88', 5: '#ff8844', 6: '#ff44ff', 7: '#44ffff',
    };
    const names: Record<number, string> = {
      0: 'P1', 1: 'P2', 2: 'P3', 3: 'P4',
      4: 'P5', 5: 'P6', 6: 'P7', 7: 'P8',
    };

    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i < numPlayers; i++) {
      const player = state.players[i];
      const x = 10 + i * Math.floor((CANVAS_WIDTH - 40) / numPlayers);
      ctx.fillStyle = colors[player.id] ?? '#ffffff';
      ctx.fillText(
        `${names[player.id] ?? 'P' + (player.id + 1)}: ${player.score}  ${player.alive ? '\u25cf' : '\u2717'}`,
        x, 20
      );
    }

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '13px monospace';
    ctx.fillText(`Battle ${state.battleNumber}`, CANVAS_WIDTH / 2, 20);

    if (state.phase === 'battle_end') {
      ctx.fillStyle = '#ffcc00';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BATTLE COMPLETE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

    if (state.phase === 'game_over' && state.winner !== null) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PLAYER ${state.winner + 1} WINS THE WAR!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    }

    if (state.phase === 'dragon') {
      ctx.fillStyle = '#8800ff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DRAGON ATTACK!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
  },
};
