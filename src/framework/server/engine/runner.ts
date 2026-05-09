import type { GameDefinition, BaseGameState, BaseInput, PlayerId, GameConfig, GameEvent } from '../../shared/types';
import type { RoomState } from '../../shared/types';
import { TICK_MS } from '../../shared/constants';

export type BroadcastFn = (roomCode: string, msg: object) => void;

export class GameRunner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private state: BaseGameState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private def: GameDefinition<any, any>;
  private inputs = new Map<PlayerId, BaseInput>();
  private roomCode: string;
  private broadcast: BroadcastFn;
  private lastTick = Date.now();

  constructor(
    def: GameDefinition<BaseGameState, BaseInput>,
    room: RoomState,
    broadcast: BroadcastFn,
  ) {
    this.def = def;
    this.roomCode = room.code;
    this.broadcast = broadcast;

    const humanIds = room.players.map(p => p.id);
    const allIds: PlayerId[] = [];
    for (let i = 0; i < def.maxPlayers; i++) allIds.push(i as PlayerId);
    const aiSlots = allIds.filter(id => !humanIds.includes(id));

    const config: GameConfig = {
      gameId: def.id,
      roomCode: room.code,
      playerIds: humanIds,
      playerNames: room.players.map(p => p.name),
      playerColors: room.players.map(p => p.color),
      aiSlots,
      settings: room.gameSettings,
    };

    this.state = def.createInitialState(config);

    // Seed inputs for all human slots
    for (const pid of humanIds) {
      this.inputs.set(pid, {});
    }
  }

  receiveInput(playerId: PlayerId, input: BaseInput): void {
    this.inputs.set(playerId, input);
  }

  start(): void {
    this.lastTick = Date.now();
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    const now = Date.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    // Compute AI inputs
    if (this.def.aiAdapter) {
      for (const pid of this.getAISlots()) {
        this.inputs.set(pid, this.def.aiAdapter.computeInput(this.state, pid));
      }
    } else {
      for (const pid of this.getAISlots()) {
        if (!this.inputs.has(pid)) this.inputs.set(pid, {});
      }
    }

    const result = this.def.tick(this.state, this.inputs, dt);
    this.state = result.state;
    const events: GameEvent[] = result.events ?? [];

    this.broadcast(this.roomCode, {
      type: 'state',
      tick: this.state.tick,
      state: this.state,
      events,
    });

    if (this.def.isGameOver(this.state)) {
      this.stop();
      const winner = this.def.getWinner(this.state);
      const scores: Record<number, number> = {};
      for (const p of this.state.players) scores[p.id] = p.score;
      this.broadcast(this.roomCode, { type: 'game_over', winner, scores });
    }
  }

  private getAISlots(): PlayerId[] {
    const humanIds = new Set(this.inputs.keys());
    // AI slots = slots not in humanIds that the game would use
    // We rely on the fact that we only seed human inputs in constructor
    // AI slots are any that the game created players for but aren't human
    return this.state.players
      .filter(p => p.isAI)
      .map(p => p.id);
  }
}
