export type PlayerId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PlayerColor = 'yellow' | 'white' | 'red' | 'blue' | 'green' | 'orange' | 'magenta' | 'cyan';

export interface BasePlayer {
  id: PlayerId;
  name: string;
  color: PlayerColor;
  score: number;
  isAI: boolean;
  connected: boolean;
}

export interface BaseGameState {
  tick: number;
  phase: string;
  players: BasePlayer[];
}

export interface BaseInput {
  [action: string]: boolean | number;
}

export interface GameEvent {
  type: string;
  [key: string]: unknown;
}

export interface TickResult<TState extends BaseGameState> {
  state: TState;
  events?: GameEvent[];
}

export interface GameConfig {
  gameId: string;
  roomCode: string;
  playerIds: PlayerId[];
  playerNames: string[];
  playerColors: PlayerColor[];
  aiSlots: PlayerId[];
  settings: Record<string, unknown>;
}

export interface ActionDescriptor {
  label: string;
  type: 'held' | 'press';
  axis?: boolean;
}

export type ActionSchema = Record<string, ActionDescriptor>;

export interface ActionMap {
  keyboard: Record<string, string>;
  mouseWheel?: { up: string; down: string };
  gamepad?: {
    buttons: Record<number, string>;
    axes: Record<number, string>;
  };
}

export interface GameRenderer<TState extends BaseGameState> {
  render(ctx: CanvasRenderingContext2D, state: TState, myPlayerId: PlayerId): void;
  init?(canvas: HTMLCanvasElement): void;
}

export interface SettingDefinition {
  key: string;
  label: string;
  type: 'range' | 'toggle' | 'select';
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface AIAdapter<TState extends BaseGameState, TInput extends BaseInput> {
  computeInput(state: TState, playerId: PlayerId): TInput;
}

export interface ClientHooks<TState extends BaseGameState> {
  onEvent?(event: GameEvent, state: TState): void;
  onGameOver?(winner: PlayerId | null, scores: Record<PlayerId, number>): void;
}

export interface GameDefinition<
  TState extends BaseGameState,
  TInput extends BaseInput
> {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  actions: ActionSchema;
  defaultActionMap: ActionMap;
  createInitialState(config: GameConfig): TState;
  tick(state: TState, inputs: Map<PlayerId, TInput>, dt: number): TickResult<TState>;
  isGameOver(state: TState): boolean;
  getWinner(state: TState): PlayerId | null;
  renderer: GameRenderer<TState>;
  settings?: SettingDefinition[];
  aiAdapter?: AIAdapter<TState, TInput>;
  onPlayerJoin?(state: TState, playerId: PlayerId): TState;
  onPlayerLeave?(state: TState, playerId: PlayerId): TState;
  howToPlay?: string;
  clientHooks?: ClientHooks<TState>;
}

// --- Network message types ---

export interface RoomPlayer {
  id: PlayerId;
  name: string;
  ready: boolean;
  color: PlayerColor;
}

export interface RoomState {
  code: string;
  gameId: string;
  name: string;
  players: RoomPlayer[];
  started: boolean;
  host: PlayerId;
  gameSettings: Record<string, unknown>;
}

// Client → Server
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'rename'; name: string }
  | { type: 'create_room'; gameId: string }
  | { type: 'join_room'; code: string }
  | { type: 'update_settings'; settings: Record<string, unknown> }
  | { type: 'leave_room' }
  | { type: 'request_room_list' }
  | { type: 'ready' }
  | { type: 'start_game' }
  | { type: 'spectate' }
  | { type: 'chat'; text: string }
  | { type: 'ping' }
  | { type: 'input'; tick: number; input: BaseInput };

// Server → Client
export type ServerMessage =
  | { type: 'connected'; playerId: PlayerId }
  | { type: 'room_update'; room: RoomState }
  | { type: 'room_list'; rooms: RoomState[] }
  | { type: 'player_joined'; player: RoomPlayer }
  | { type: 'player_left'; playerId: PlayerId }
  | { type: 'error'; message: string }
  | { type: 'pong' }
  | { type: 'game_start'; playerId: PlayerId; gameId: string; settings: Record<string, unknown> }
  | { type: 'state'; tick: number; state: BaseGameState; events: GameEvent[] }
  | { type: 'game_over'; winner: PlayerId | null; scores: Record<PlayerId, number> };
