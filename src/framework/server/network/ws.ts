import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import type { PlayerId, BaseGameState, BaseInput, GameDefinition } from '../../shared/types';
import { RoomManager, registerServerGame } from '../lobby/rooms';
import { GameRunner } from '../engine/runner';

interface Connection {
  ws: WebSocket;
  socketId: string;
  playerId: PlayerId | null;
  name: string;
}

let nextSocketId = 0;
const connections = new Map<string, Connection>();
const activeGames = new Map<string, GameRunner>(); // roomCode → runner
const roomManager = new RoomManager();

export function registerGame(def: GameDefinition<BaseGameState, BaseInput>): void {
  registerServerGame(def);
}

function broadcast(roomCode: string, msg: object): void {
  const json = JSON.stringify(msg);
  for (const conn of connections.values()) {
    const info = roomManager.getRoomForSocket(conn.socketId);
    if (info?.roomCode === roomCode && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(json);
    }
  }
}

function send(conn: Connection, msg: object): void {
  if (conn.ws.readyState === WebSocket.OPEN) {
    conn.ws.send(JSON.stringify(msg));
  }
}

export function attachWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const socketId = String(nextSocketId++);
    // Assign a temporary playerId until they join a room
    const conn: Connection = { ws, socketId, playerId: null, name: 'Player' };
    connections.set(socketId, conn);

    // Send connected ack — playerId is assigned per-room, use 0 as placeholder
    send(conn, { type: 'connected', playerId: 0 });

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      switch (msg.type) {
        case 'join': {
          conn.name = (msg.name as string) || 'Player';
          break;
        }

        case 'rename': {
          conn.name = (msg.name as string) || conn.name;
          roomManager.rename(socketId, conn.name);
          const info = roomManager.getRoomForSocket(socketId);
          if (info) broadcast(info.roomCode, { type: 'room_update', room: roomManager.getRoom(info.roomCode) });
          break;
        }

        case 'create_room': {
          const result = roomManager.createRoom(socketId, msg.gameId as string, conn.name);
          if ('error' in result) { send(conn, { type: 'error', message: result.error }); return; }
          conn.playerId = result.host;
          send(conn, { type: 'connected', playerId: result.host });
          send(conn, { type: 'room_update', room: result });
          break;
        }

        case 'join_room': {
          const result = roomManager.joinRoom(socketId, msg.code as string, conn.name);
          if ('error' in result) { send(conn, { type: 'error', message: result.error }); return; }
          const joinedPlayer = roomManager.getRoomForSocket(socketId);
          if (joinedPlayer) {
            conn.playerId = joinedPlayer.playerId;
            send(conn, { type: 'connected', playerId: joinedPlayer.playerId });
          }
          broadcast(result.code, { type: 'room_update', room: result });
          break;
        }

        case 'leave_room': {
          const left = roomManager.leaveRoom(socketId);
          if (left) {
            conn.playerId = null;
            broadcast(left.room.code, { type: 'room_update', room: left.room });
          }
          break;
        }

        case 'request_room_list': {
          send(conn, { type: 'room_list', rooms: roomManager.listOpenRooms() });
          break;
        }

        case 'ready': {
          const toggled = roomManager.toggleReady(socketId);
          if (toggled) broadcast(toggled.code, { type: 'room_update', room: toggled });
          break;
        }

        case 'start_game': {
          const check = roomManager.canStart(socketId);
          if (!check.ok) { send(conn, { type: 'error', message: check.error! }); return; }
          const room = check.room!;

          // Import game def lazily via registry
          const { getGameDef } = require('../lobby/rooms');
          const def = getGameDef(room.gameId);
          if (!def) { send(conn, { type: 'error', message: 'Game not found' }); return; }

          const runner = new GameRunner(def, room, broadcast);
          activeGames.set(room.code, runner);

          broadcast(room.code, {
            type: 'game_start',
            gameId: room.gameId,
            settings: room.gameSettings,
          });

          // Tell each player their id
          for (const conn2 of connections.values()) {
            const info = roomManager.getRoomForSocket(conn2.socketId);
            if (info?.roomCode === room.code) {
              const rp = room.players.find(p => p.id === (roomManager.getRoomForSocket(conn2.socketId)?.playerId));
              send(conn2, { type: 'connected', playerId: rp?.id ?? 0 });
            }
          }

          runner.start();
          break;
        }

        case 'input': {
          const info = roomManager.getRoomForSocket(socketId);
          if (!info) return;
          const runner = activeGames.get(info.roomCode);
          if (!runner) return;
          runner.receiveInput(info.playerId, msg.input as BaseInput);
          break;
        }

        case 'ping': {
          send(conn, { type: 'pong' });
          break;
        }
      }
    });

    ws.on('close', () => {
      const left = roomManager.leaveRoom(socketId);
      if (left) {
        broadcast(left.room.code, { type: 'room_update', room: left.room });
      }
      connections.delete(socketId);
    });
  });
}
