import type { ClientMessage, ServerMessage } from '../../shared/types';

type MessageHandler = (msg: ServerMessage) => void;

export class GameWebSocket {
  private ws: WebSocket | null = null;
  private queue: ClientMessage[] = [];
  private handlers: MessageHandler[] = [];
  private url: string;
  private reconnectDelay = 1000;

  constructor(url?: string) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.url = url ?? `${proto}://${location.host}/ws`;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      // Try fallback
      this.ws = new WebSocket(`ws://localhost:3000/ws`);
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      for (const msg of this.queue) this.rawSend(msg);
      this.queue = [];
    };

    this.ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(ev.data); } catch { return; }
      for (const h of this.handlers) h(msg);
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.rawSend(msg);
    } else {
      this.queue.push(msg);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter(h => h !== handler); };
  }

  private rawSend(msg: ClientMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }
}
