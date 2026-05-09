/**
 * Cloudflare Worker — WebSocket proxy using Durable Objects.
 *
 * Each room runs inside a GameRoom Durable Object so state is colocated.
 * The Worker routes:
 *   /ws  → WebSocket upgrade → GameRoom DO
 *   *    → static assets from Pages (handled by Cloudflare Pages binding)
 */

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher; // Cloudflare Pages static asset binding
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      // Use a single global room coordinator DO
      // In production you'd route by room code to a per-room DO
      const id = env.GAME_ROOM.idFromName('coordinator');
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    // All other requests → static assets (Cloudflare Pages)
    return env.ASSETS.fetch(request);
  },
};

// ---------------------------------------------------------------------------
// Durable Object: GameRoom
// Manages WebSocket connections and runs the game server logic.
// ---------------------------------------------------------------------------

import { registerServerGame } from '../framework/server/lobby/rooms';
import tetrominoGame from '../games/tetromino/definition';

// Register games inside the DO module scope
registerServerGame(tetrominoGame as any);

type WSState = { ws: WebSocket; socketId: string; quit: boolean };

export class GameRoom {
  private state: DurableObjectState;
  private connections = new Map<string, WSState>();
  private nextId = 0;

  // We reuse the same RoomManager + game runner logic from the Node server,
  // but scoped to this Durable Object instance.
  private roomMgr: import('../framework/server/lobby/rooms').RoomManager;
  private runners = new Map<string, import('../framework/server/engine/runner').GameRunner>();

  constructor(state: DurableObjectState) {
    this.state = state;
    const { RoomManager } = require('../framework/server/lobby/rooms');
    this.roomMgr = new RoomManager();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.handleSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private handleSocket(ws: WebSocket): void {
    this.state.acceptWebSocket(ws);
    const socketId = String(this.nextId++);
    this.connections.set(socketId, { ws, socketId, quit: false });

    ws.send(JSON.stringify({ type: 'connected', playerId: 0 }));
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const conn = [...this.connections.values()].find(c => c.ws === ws);
    if (!conn) return;

    let msg: Record<string, unknown>;
    try { msg = JSON.parse(message.toString()); } catch { return; }

    // Delegate to shared message handler
    this.handleMessage(conn.socketId, msg, ws);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const conn = [...this.connections.values()].find(c => c.ws === ws);
    if (!conn) return;
    conn.quit = true;

    const left = this.roomMgr.leaveRoom(conn.socketId);
    if (left) this.broadcast(left.room.code, { type: 'room_update', room: left.room });
    this.connections.delete(conn.socketId);
  }

  private broadcast(roomCode: string, msg: object): void {
    const json = JSON.stringify(msg);
    for (const conn of this.connections.values()) {
      const info = this.roomMgr.getRoomForSocket(conn.socketId);
      if (info?.roomCode === roomCode && !conn.quit) {
        try { conn.ws.send(json); } catch { /* ignore closed */ }
      }
    }
  }

  private send(ws: WebSocket, msg: object): void {
    try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
  }

  private handleMessage(socketId: string, msg: Record<string, unknown>, ws: WebSocket): void {
    const send = (m: object) => this.send(ws, m);
    const { getGameDef } = require('../framework/server/lobby/rooms');
    const { GameRunner } = require('../framework/server/engine/runner');

    switch (msg.type) {
      case 'join': break; // name tracked by room join
      case 'create_room': {
        const name = (msg.name as string) || 'Player';
        const result = this.roomMgr.createRoom(socketId, msg.gameId as string, name);
        if ('error' in result) { send({ type: 'error', message: result.error }); return; }
        send({ type: 'room_update', room: result });
        break;
      }
      case 'join_room': {
        const name = (msg.name as string) || 'Player';
        const result = this.roomMgr.joinRoom(socketId, msg.code as string, name);
        if ('error' in result) { send({ type: 'error', message: result.error }); return; }
        this.broadcast(result.code, { type: 'room_update', room: result });
        break;
      }
      case 'leave_room': {
        const left = this.roomMgr.leaveRoom(socketId);
        if (left) this.broadcast(left.room.code, { type: 'room_update', room: left.room });
        break;
      }
      case 'ready': {
        const room = this.roomMgr.setReady(socketId, true);
        if (room) this.broadcast(room.code, { type: 'room_update', room });
        break;
      }
      case 'start_game': {
        const check = this.roomMgr.canStart(socketId);
        if (!check.ok) { send({ type: 'error', message: check.error! }); return; }
        const room = check.room!;
        const def = getGameDef(room.gameId);
        if (!def) { send({ type: 'error', message: 'Game not found' }); return; }

        const runner = new GameRunner(def, room, this.broadcast.bind(this));
        this.runners.set(room.code, runner);

        this.broadcast(room.code, { type: 'game_start', gameId: room.gameId, settings: room.gameSettings });
        runner.start();
        break;
      }
      case 'input': {
        const info = this.roomMgr.getRoomForSocket(socketId);
        if (!info) return;
        const runner = this.runners.get(info.roomCode);
        if (!runner) return;
        runner.receiveInput(info.playerId, msg.input as any);
        break;
      }
      case 'ping': send({ type: 'pong' }); break;
    }
  }
}
