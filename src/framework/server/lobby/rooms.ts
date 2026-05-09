import type { PlayerId, PlayerColor, RoomState, RoomPlayer, GameDefinition, BaseGameState, BaseInput } from '../../shared/types';
import { generateRoomCode } from '../../shared/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gameRegistry = new Map<string, GameDefinition<any, any>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerServerGame(def: GameDefinition<any, any>): void {
  gameRegistry.set(def.id, def);
}

export function getGameDef(gameId: string): GameDefinition<BaseGameState, BaseInput> | undefined {
  return gameRegistry.get(gameId);
}

const COLORS: PlayerColor[] = ['yellow', 'white', 'red', 'blue', 'green', 'orange', 'magenta', 'cyan'];

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  // socketId → playerId (globally unique connection id)
  private socketToPlayer = new Map<string, { roomCode: string; playerId: PlayerId }>();

  createRoom(socketId: string, gameId: string, hostName: string): RoomState | { error: string } {
    const def = gameRegistry.get(gameId);
    if (!def) return { error: `Unknown game: ${gameId}` };

    const existing = this.getRoomForSocket(socketId);
    if (existing) return { error: 'Already in a room' };

    const code = generateRoomCode();
    const playerId = 0 as PlayerId;
    const room: RoomState = {
      code,
      gameId,
      name: `${hostName}'s room`,
      players: [{ id: playerId, name: hostName, ready: false, color: COLORS[0] }],
      started: false,
      host: playerId,
      gameSettings: Object.fromEntries(
        (def.settings ?? []).map(s => [s.key, s.default])
      ),
    };
    this.rooms.set(code, room);
    this.socketToPlayer.set(socketId, { roomCode: code, playerId });
    return room;
  }

  joinRoom(socketId: string, code: string, name: string): RoomState | { error: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { error: 'Room not found' };
    if (room.started) return { error: 'Game already started' };

    const def = gameRegistry.get(room.gameId);
    if (!def) return { error: 'Game not found' };
    if (room.players.length >= def.maxPlayers) return { error: 'Room is full' };

    const existing = this.getRoomForSocket(socketId);
    if (existing) return { error: 'Already in a room' };

    // Find first free slot id
    const usedIds = new Set(room.players.map(p => p.id));
    let playerId = 0 as PlayerId;
    for (let i = 0; i < 8; i++) {
      if (!usedIds.has(i as PlayerId)) { playerId = i as PlayerId; break; }
    }

    room.players.push({ id: playerId, name, ready: false, color: COLORS[playerId] });
    this.socketToPlayer.set(socketId, { roomCode: code.toUpperCase(), playerId });
    return room;
  }

  leaveRoom(socketId: string): { room: RoomState; playerId: PlayerId } | null {
    const info = this.socketToPlayer.get(socketId);
    if (!info) return null;
    const room = this.rooms.get(info.roomCode);
    if (!room) { this.socketToPlayer.delete(socketId); return null; }

    room.players = room.players.filter(p => p.id !== info.playerId);
    this.socketToPlayer.delete(socketId);

    if (room.players.length === 0) {
      this.rooms.delete(info.roomCode);
      return null;
    }

    // Transfer host if needed
    if (room.host === info.playerId) {
      room.host = room.players[0].id;
    }

    return { room, playerId: info.playerId };
  }

  toggleReady(socketId: string): RoomState | null {
    const info = this.socketToPlayer.get(socketId);
    if (!info) return null;
    const room = this.rooms.get(info.roomCode);
    if (!room) return null;
    const player = room.players.find(p => p.id === info.playerId);
    if (player) player.ready = !player.ready;
    return room;
  }

  canStart(socketId: string): { ok: boolean; error?: string; room?: RoomState } {
    const info = this.socketToPlayer.get(socketId);
    if (!info) return { ok: false, error: 'Not in a room' };
    const room = this.rooms.get(info.roomCode);
    if (!room) return { ok: false, error: 'Room not found' };
    if (room.host !== info.playerId) return { ok: false, error: 'Only the host can start' };

    const def = gameRegistry.get(room.gameId);
    if (!def) return { ok: false, error: 'Game not found' };
    if (room.players.length < def.minPlayers) return { ok: false, error: `Need at least ${def.minPlayers} players` };
    if (!room.players.every(p => p.ready || p.id === room.host)) return { ok: false, error: 'Not all players are ready' };

    return { ok: true, room };
  }

  markStarted(code: string): void {
    const room = this.rooms.get(code);
    if (room) room.started = true;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  getRoomForSocket(socketId: string): { roomCode: string; playerId: PlayerId } | undefined {
    return this.socketToPlayer.get(socketId);
  }

  listOpenRooms(): RoomState[] {
    return [...this.rooms.values()].filter(r => !r.started);
  }

  rename(socketId: string, name: string): void {
    const info = this.socketToPlayer.get(socketId);
    if (!info) return;
    const room = this.rooms.get(info.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === info.playerId);
    if (player) player.name = name;
    if (room.host === info.playerId) room.name = `${name}'s room`;
  }

  updateSettings(socketId: string, settings: Record<string, unknown>): RoomState | null {
    const info = this.socketToPlayer.get(socketId);
    if (!info) return null;
    const room = this.rooms.get(info.roomCode);
    if (!room || room.host !== info.playerId || room.started) return null;
    const def = gameRegistry.get(room.gameId);
    if (!def) return null;
    for (const s of def.settings ?? []) {
      if (Object.prototype.hasOwnProperty.call(settings, s.key)) {
        room.gameSettings[s.key] = settings[s.key];
      }
    }
    return room;
  }
}
