"use strict";
(() => {
  // src/framework/client/network/ws.ts
  var GameWebSocket = class {
    ws = null;
    queue = [];
    handlers = [];
    url;
    reconnectDelay = 1e3;
    constructor(url) {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      this.url = url ?? `${proto}://${location.host}/ws`;
    }
    connect() {
      try {
        this.ws = new WebSocket(this.url);
      } catch {
        this.ws = new WebSocket(`ws://localhost:3000/ws`);
      }
      this.ws.onopen = () => {
        this.reconnectDelay = 1e3;
        for (const msg of this.queue)
          this.rawSend(msg);
        this.queue = [];
      };
      this.ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        for (const h of this.handlers)
          h(msg);
      };
      this.ws.onclose = () => {
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 1e4);
      };
    }
    send(msg) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.rawSend(msg);
      } else {
        this.queue.push(msg);
      }
    }
    onMessage(handler) {
      this.handlers.push(handler);
      return () => {
        this.handlers = this.handlers.filter((h) => h !== handler);
      };
    }
    rawSend(msg) {
      this.ws?.send(JSON.stringify(msg));
    }
  };

  // src/framework/client/input/handler.ts
  var InputHandler = class {
    heldKeys = /* @__PURE__ */ new Set();
    pressedKeys = /* @__PURE__ */ new Set();
    schema = {};
    actionMap = { keyboard: {} };
    wheelActions = {};
    init(schema, actionMap) {
      this.schema = schema;
      this.actionMap = actionMap;
      this.wheelActions = actionMap.mouseWheel ?? {};
    }
    attach() {
      window.addEventListener("keydown", this.onKeyDown);
      window.addEventListener("keyup", this.onKeyUp);
      window.addEventListener("wheel", this.onWheel, { passive: true });
    }
    detach() {
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      window.removeEventListener("wheel", this.onWheel);
      this.heldKeys.clear();
      this.pressedKeys.clear();
    }
    onKeyDown = (e) => {
      this.heldKeys.add(e.code);
      this.pressedKeys.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
    };
    onKeyUp = (e) => {
      this.heldKeys.delete(e.code);
    };
    onWheel = (e) => {
      if (e.deltaY < 0 && this.wheelActions.up)
        this.pressedKeys.add("__wheel_up__");
      if (e.deltaY > 0 && this.wheelActions.down)
        this.pressedKeys.add("__wheel_down__");
    };
    // Call once per frame after sending input to consume press events
    flush() {
      this.pressedKeys.clear();
    }
    getInput() {
      const input = {};
      const km = this.actionMap.keyboard;
      for (const [code, action] of Object.entries(km)) {
        const desc = this.schema[action];
        if (!desc)
          continue;
        if (desc.type === "held" && this.heldKeys.has(code)) {
          input[action] = true;
        } else if (desc.type === "press" && this.pressedKeys.has(code)) {
          input[action] = true;
        }
      }
      if (this.wheelActions.up && this.pressedKeys.has("__wheel_up__"))
        input[this.wheelActions.up] = true;
      if (this.wheelActions.down && this.pressedKeys.has("__wheel_down__"))
        input[this.wheelActions.down] = true;
      return input;
    }
  };

  // src/framework/client/ui/manager.ts
  var gameRegistry = /* @__PURE__ */ new Map();
  function registerClientGame(def) {
    gameRegistry.set(def.id, def);
  }
  var UIManager = class {
    screen = "connecting";
    socket;
    input = new InputHandler();
    canvas;
    ctx;
    root;
    myPlayerId = 0;
    currentRoom = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentGame = null;
    latestState = null;
    gameOverData = null;
    rafId = null;
    pingInterval = null;
    roomListInterval = null;
    // Browser screen state
    browsedGameId = "";
    openRooms = [];
    errorMessage = "";
    constructor(root2) {
      this.root = root2;
      this.canvas = document.createElement("canvas");
      this.canvas.width = 800;
      this.canvas.height = 600;
      this.ctx = this.canvas.getContext("2d");
      this.socket = new GameWebSocket();
    }
    start() {
      this.socket.connect();
      this.socket.onMessage((msg) => this.handleMessage(msg));
      this.pingInterval = setInterval(() => this.socket.send({ type: "ping" }), 1e3);
      this.renderUI();
    }
    handleMessage(msg) {
      switch (msg.type) {
        case "connected":
          this.myPlayerId = msg.playerId;
          if (this.screen === "connecting") {
            this.socket.send({ type: "join", name: this.getStoredName() });
            this.setScreen("main_menu");
          }
          break;
        case "room_list":
          this.openRooms = msg.rooms;
          if (this.screen === "browser")
            this.renderUI();
          break;
        case "room_update":
          this.currentRoom = msg.room;
          this.errorMessage = "";
          if (this.screen !== "game")
            this.setScreen("lobby");
          break;
        case "error":
          this.errorMessage = msg.message;
          this.renderUI();
          break;
        case "game_start":
          this.currentGame = gameRegistry.get(msg.gameId) ?? null;
          if (this.currentGame) {
            this.input.init(this.currentGame.actions, this.currentGame.defaultActionMap);
            this.input.attach();
            if (this.currentGame.renderer.init)
              this.currentGame.renderer.init(this.canvas);
          }
          this.myPlayerId = msg.playerId;
          this.stopRoomListPolling();
          this.setScreen("game");
          this.startGameLoop();
          break;
        case "state":
          this.latestState = msg.state;
          if (this.currentGame?.clientHooks?.onEvent && msg.events?.length) {
            for (const ev of msg.events)
              this.currentGame.clientHooks.onEvent(ev, msg.state);
          }
          break;
        case "game_over":
          this.gameOverData = { winner: msg.winner, scores: msg.scores };
          if (this.currentGame?.clientHooks?.onGameOver) {
            this.currentGame.clientHooks.onGameOver(msg.winner, msg.scores);
          }
          this.stopGameLoop();
          this.input.detach();
          this.setScreen("game_over");
          break;
      }
    }
    startGameLoop() {
      const loop = () => {
        if (this.screen !== "game")
          return;
        if (this.latestState && this.currentGame) {
          const input = this.input.getInput();
          this.socket.send({ type: "input", tick: this.latestState.tick, input });
          this.input.flush();
          this.ctx.fillStyle = "#000";
          this.ctx.fillRect(0, 0, 800, 600);
          this.currentGame.renderer.render(this.ctx, this.latestState, this.myPlayerId);
        }
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }
    stopGameLoop() {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
    startRoomListPolling() {
      this.socket.send({ type: "request_room_list" });
      this.roomListInterval = setInterval(() => {
        this.socket.send({ type: "request_room_list" });
      }, 3e3);
    }
    stopRoomListPolling() {
      if (this.roomListInterval !== null) {
        clearInterval(this.roomListInterval);
        this.roomListInterval = null;
      }
    }
    setScreen(s) {
      if (this.screen === "browser" && s !== "browser")
        this.stopRoomListPolling();
      this.screen = s;
      if (s === "browser")
        this.startRoomListPolling();
      this.renderUI();
    }
    renderUI() {
      this.root.innerHTML = "";
      switch (this.screen) {
        case "connecting":
          this.root.appendChild(el("div", { className: "screen center" }, [
            el("p", { className: "muted" }, ["Connecting to server\u2026"])
          ]));
          break;
        case "main_menu":
          this.renderMainMenu();
          break;
        case "browser":
          this.renderBrowser();
          break;
        case "lobby":
          this.renderLobby();
          break;
        case "game":
          this.root.appendChild(this.canvas);
          break;
        case "game_over":
          this.renderGameOver();
          break;
      }
    }
    // ─── Screens ──────────────────────────────────────────────────────────────
    renderMainMenu() {
      const games = [...gameRegistry.values()];
      const nameRow = el("div", { className: "name-row" }, [
        el("label", {}, [
          "Your name ",
          (() => {
            const inp = document.createElement("input");
            inp.maxLength = 16;
            inp.value = this.getStoredName();
            inp.addEventListener("change", () => {
              localStorage.setItem("playerName", inp.value.trim() || "Player");
              this.socket.send({ type: "rename", name: inp.value.trim() || "Player" });
            });
            return inp;
          })()
        ])
      ]);
      const gameList = el("div", { className: "game-list" }, games.map(
        (def) => el("div", { className: "game-card" }, [
          el("div", { className: "game-card-body" }, [
            el("h2", {}, [def.name]),
            el("p", { className: "muted" }, [def.description])
          ]),
          el("button", {
            className: "btn-primary",
            onclick: () => {
              this.browsedGameId = def.id;
              this.openRooms = [];
              this.errorMessage = "";
              this.setScreen("browser");
            }
          }, ["Play"])
        ])
      ));
      this.root.appendChild(el("div", { className: "screen main-menu" }, [
        el("h1", {}, ["Party Games"]),
        nameRow,
        gameList
      ]));
    }
    renderBrowser() {
      const def = gameRegistry.get(this.browsedGameId);
      const rooms = this.openRooms.filter((r) => r.gameId === this.browsedGameId);
      const listContent = rooms.length > 0 ? rooms.map((room) => {
        const maxPlayers = def?.maxPlayers ?? 8;
        const isFull = room.players.length >= maxPlayers;
        return el("div", { className: "room-row" }, [
          el("div", { className: "room-info" }, [
            el("span", { className: "room-name" }, [room.name]),
            el("span", { className: "room-meta" }, [
              `${room.players.length}/${maxPlayers} players`,
              el("span", { className: "room-code" }, [room.code])
            ])
          ]),
          el("button", {
            className: isFull ? "btn-disabled" : "btn-secondary",
            disabled: isFull,
            onclick: () => {
              this.socket.send({ type: "join_room", code: room.code });
            }
          }, [isFull ? "Full" : "Join"])
        ]);
      }) : [el("p", { className: "empty-state" }, ["No open lobbies. Create one!"])];
      let codeInput;
      const joinByCode = el("div", { className: "join-code-row" }, [
        (() => {
          codeInput = document.createElement("input");
          codeInput.placeholder = "Room code";
          codeInput.maxLength = 5;
          codeInput.className = "code-input";
          codeInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter")
              joinByCodeFn();
          });
          return codeInput;
        })(),
        el("button", {
          className: "btn-secondary",
          onclick: () => joinByCodeFn()
        }, ["Join by Code"])
      ]);
      const joinByCodeFn = () => {
        const code = codeInput.value.trim().toUpperCase();
        if (code.length !== 5) {
          this.errorMessage = "Room codes are 5 characters.";
          this.renderUI();
          return;
        }
        this.socket.send({ type: "join_room", code });
      };
      const errorEl = this.errorMessage ? el("p", { className: "error-msg" }, [this.errorMessage]) : null;
      this.root.appendChild(el("div", { className: "screen browser" }, [
        el("div", { className: "browser-header" }, [
          el("button", {
            className: "btn-back",
            onclick: () => {
              this.errorMessage = "";
              this.setScreen("main_menu");
            }
          }, ["\u2190 Back"]),
          el("h1", {}, [def?.name ?? "Game"]),
          el("button", {
            className: "btn-primary",
            onclick: () => this.socket.send({ type: "create_room", gameId: this.browsedGameId })
          }, ["+ Create Room"])
        ]),
        ...errorEl ? [errorEl] : [],
        el("div", { className: "room-list" }, [
          el("div", { className: "section-label" }, [
            "Open Lobbies",
            el("span", { className: "refresh-note" }, [" (refreshes every 3s)"])
          ]),
          ...listContent
        ]),
        el("div", { className: "divider" }, ["\u2014 or join by code \u2014"]),
        joinByCode
      ]));
    }
    renderLobby() {
      const room = this.currentRoom;
      if (!room)
        return;
      const def = gameRegistry.get(room.gameId);
      const maxPlayers = def?.maxPlayers ?? 8;
      const me = room.players.find((p) => p.id === this.myPlayerId);
      const isHost = room.host === this.myPlayerId;
      const allNonHostReady = room.players.filter((p) => p.id !== room.host).every((p) => p.ready);
      const canStart = isHost && room.players.length >= (def?.minPlayers ?? 2) && allNonHostReady;
      const playerRows = room.players.map((p) => {
        const isMe = p.id === this.myPlayerId;
        const hostBadge = p.id === room.host ? el("span", { className: "badge badge-host" }, ["HOST"]) : null;
        const meBadge = isMe ? el("span", { className: "badge badge-me" }, ["YOU"]) : null;
        const readyBadge = p.id === room.host ? el("span", { className: "badge badge-neutral" }, ["\u2014"]) : el("span", { className: `badge ${p.ready ? "badge-ready" : "badge-waiting"}` }, [p.ready ? "\u2713 Ready" : "\u2026 Waiting"]);
        return el("div", { className: `player-row${isMe ? " player-row-me" : ""}` }, [
          el("span", { className: "player-swatch", style: `background:${PLAYER_COLORS[p.id]}` }, []),
          el("span", { className: "player-name" }, [p.name]),
          el("span", { className: "player-badges" }, [
            ...hostBadge ? [hostBadge] : [],
            ...meBadge ? [meBadge] : [],
            readyBadge
          ])
        ]);
      });
      const actions2 = [];
      if (me && !isHost) {
        actions2.push(el("button", {
          className: me.ready ? "btn-secondary" : "btn-primary",
          onclick: () => this.socket.send({ type: "ready" })
        }, [me.ready ? "Unready" : "Ready"]));
      }
      if (isHost) {
        const startBtn = el("button", {
          className: canStart ? "btn-primary" : "btn-disabled",
          disabled: !canStart,
          onclick: () => {
            if (canStart)
              this.socket.send({ type: "start_game" });
          }
        }, ["Start Game"]);
        actions2.push(startBtn);
        if (!canStart) {
          const hint = room.players.length < (def?.minPlayers ?? 2) ? `Need at least ${def?.minPlayers ?? 2} players` : "Waiting for all players to ready up";
          actions2.push(el("p", { className: "muted hint" }, [hint]));
        }
      }
      actions2.push(el("button", {
        className: "btn-danger",
        onclick: () => {
          this.socket.send({ type: "leave_room" });
          this.currentRoom = null;
          this.errorMessage = "";
          if (this.browsedGameId) {
            this.setScreen("browser");
          } else {
            this.setScreen("main_menu");
          }
        }
      }, ["Leave Room"]));
      const errorEl = this.errorMessage ? el("p", { className: "error-msg" }, [this.errorMessage]) : null;
      this.root.appendChild(el("div", { className: "screen lobby" }, [
        el("div", { className: "lobby-header" }, [
          el("div", {}, [
            el("h1", {}, [room.name]),
            el("p", { className: "muted" }, [`${def?.name ?? ""} \xB7 ${room.players.length}/${maxPlayers} players`])
          ]),
          el("div", { className: "room-code-display" }, [
            el("span", { className: "code-label" }, ["Room Code"]),
            el("span", { className: "code-value" }, [room.code])
          ])
        ]),
        ...errorEl ? [errorEl] : [],
        el("div", { className: "player-list" }, playerRows),
        el("div", { className: "lobby-actions" }, actions2)
      ]));
    }
    renderGameOver() {
      const data = this.gameOverData;
      const room = this.currentRoom;
      let winnerText = "Game Over";
      if (data) {
        if (data.winner !== null) {
          const winnerPlayer = room?.players.find((p) => p.id === data.winner);
          winnerText = `${winnerPlayer?.name ?? `Player ${data.winner + 1}`} wins!`;
        } else {
          winnerText = "Draw!";
        }
      }
      const scoreRows = data ? Object.entries(data.scores).sort(([, a], [, b]) => b - a).map(([pid, score]) => {
        const player = room?.players.find((p) => p.id === Number(pid));
        return el("div", { className: "score-row" }, [
          el("span", { className: "player-swatch", style: `background:${PLAYER_COLORS[Number(pid)]}` }, []),
          el("span", {}, [player?.name ?? `Player ${Number(pid) + 1}`]),
          el("span", { className: "score-value" }, [String(score)])
        ]);
      }) : [];
      this.root.appendChild(el("div", { className: "screen game-over" }, [
        el("h1", {}, [winnerText]),
        ...scoreRows.length ? [el("div", { className: "score-list" }, scoreRows)] : [],
        el("div", { className: "game-over-actions" }, [
          el("button", {
            className: "btn-primary",
            onclick: () => {
              this.latestState = null;
              this.gameOverData = null;
              this.currentGame = null;
              this.currentRoom = null;
              this.errorMessage = "";
              this.setScreen("browser");
            }
          }, ["Play Again"]),
          el("button", {
            className: "btn-secondary",
            onclick: () => {
              this.latestState = null;
              this.gameOverData = null;
              this.currentGame = null;
              this.currentRoom = null;
              this.browsedGameId = "";
              this.errorMessage = "";
              this.setScreen("main_menu");
            }
          }, ["Main Menu"])
        ])
      ]));
    }
    getStoredName() {
      return localStorage.getItem("playerName") ?? "Player";
    }
  };
  var PLAYER_COLORS = {
    0: "#ffff00",
    1: "#ffffff",
    2: "#ff4444",
    3: "#4488ff",
    4: "#44ff88",
    5: "#ff8844",
    6: "#ff44ff",
    7: "#44ffff"
  };
  function el(tag, attrs, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null)
        continue;
      if (k === "onclick") {
        node.addEventListener("click", v);
      } else if (k === "disabled") {
        if (v)
          node.disabled = true;
      } else if (k === "className") {
        node.className = v;
      } else if (k === "style") {
        node.setAttribute("style", v);
      } else {
        node.setAttribute(k, String(v));
      }
    }
    for (const child of children) {
      if (child == null)
        continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  // src/games/tetromino/constants.ts
  var BOARD_COLS = 10;
  var BOARD_ROWS = 20;
  var CELL_SIZE = 18;
  var PANEL_WIDTH = BOARD_COLS * CELL_SIZE;
  var PANEL_HEIGHT = BOARD_ROWS * CELL_SIZE;
  var BASE_GRAVITY = 1;
  var GRAVITY_INCREMENT = 0.3;
  var LINE_POINTS = [0, 100, 300, 500, 800];
  var GARBAGE_PER_LINE = [0, 0, 1, 2, 4];
  var LOCK_DELAY_TICKS = 30;
  var TETROMINO_SHAPES = {
    // Each entry: [rotation0, rotation1, rotation2, rotation3], each rotation is array of [row, col] offsets
    I: [
      [[1, 0], [1, 1], [1, 2], [1, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 1], [1, 1], [2, 1], [3, 1]]
    ],
    O: [
      [[0, 1], [0, 2], [1, 1], [1, 2]],
      [[0, 1], [0, 2], [1, 1], [1, 2]],
      [[0, 1], [0, 2], [1, 1], [1, 2]],
      [[0, 1], [0, 2], [1, 1], [1, 2]]
    ],
    T: [
      [[0, 1], [1, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 1]],
      [[0, 1], [1, 0], [1, 1], [2, 1]]
    ],
    S: [
      [[0, 1], [0, 2], [1, 0], [1, 1]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 1], [1, 2], [2, 0], [2, 1]],
      [[0, 0], [1, 0], [1, 1], [2, 1]]
    ],
    Z: [
      [[0, 0], [0, 1], [1, 1], [1, 2]],
      [[0, 2], [1, 1], [1, 2], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[0, 1], [1, 0], [1, 1], [2, 0]]
    ],
    J: [
      [[0, 0], [1, 0], [1, 1], [1, 2]],
      [[0, 1], [0, 2], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 0], [2, 1]]
    ],
    L: [
      [[0, 2], [1, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [1, 2], [2, 0]],
      [[0, 0], [0, 1], [1, 1], [2, 1]]
    ]
  };
  var TETROMINO_COLORS = {
    I: "#00ffff",
    O: "#ffff00",
    T: "#aa00ff",
    S: "#00ff00",
    Z: "#ff0000",
    J: "#0000ff",
    L: "#ff8800"
  };
  var TETROMINO_TYPES = ["I", "O", "T", "S", "Z", "J", "L"];

  // src/framework/shared/utils.ts
  function seededRandom(seed) {
    const x = Math.sin(seed + 1) * 1e4;
    return x - Math.floor(x);
  }

  // src/games/tetromino/state.ts
  function emptyBoard() {
    return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  }
  function pickPiece(seed) {
    return TETROMINO_TYPES[Math.floor(seededRandom(seed) * TETROMINO_TYPES.length)];
  }
  function createInitialState(config) {
    const seed = Date.now() % 1e6;
    const players = config.playerIds.map((id, i) => ({
      id,
      name: config.playerNames[i],
      color: config.playerColors[i],
      score: 0,
      isAI: config.aiSlots.includes(id),
      connected: true,
      board: emptyBoard(),
      current: spawnPiece(pickPiece(seed + id * 100)),
      next: pickPiece(seed + id * 100 + 1),
      held: null,
      holdUsed: false,
      gravityAccum: 0,
      lockTimer: 0,
      lockActive: false,
      linesCleared: 0,
      level: 1,
      dead: false,
      pendingGarbage: 0
    }));
    return {
      tick: 0,
      phase: "playing",
      players,
      seed
    };
  }
  function spawnPiece(type) {
    return { type, rotation: 0, row: 0, col: 3 };
  }

  // src/games/tetromino/engine.ts
  function getCells(t) {
    return TETROMINO_SHAPES[t.type][t.rotation].map(([r, c]) => [t.row + r, t.col + c]);
  }
  function isValid(board, t) {
    for (const [r, c] of getCells(t)) {
      if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS)
        return false;
      if (board[r][c] !== null)
        return false;
    }
    return true;
  }
  function lockPiece(board, t) {
    const color = TETROMINO_COLORS[t.type];
    for (const [r, c] of getCells(t)) {
      if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
        board[r][c] = color;
      }
    }
  }
  function clearLines(board) {
    const kept = board.filter((row) => row.some((cell) => cell === null));
    const cleared = BOARD_ROWS - kept.length;
    while (kept.length < BOARD_ROWS)
      kept.unshift(Array(BOARD_COLS).fill(null));
    board.splice(0, BOARD_ROWS, ...kept);
    return cleared;
  }
  function addGarbageLines(board, count, seed) {
    const gapCol = Math.floor(seededRandom(seed) * BOARD_COLS);
    for (let i = 0; i < count; i++) {
      board.shift();
      const garbageLine = Array(BOARD_COLS).fill("#555555");
      garbageLine[gapCol] = null;
      board.push(garbageLine);
    }
  }
  function hardDropRow(board, t) {
    let piece = { ...t };
    while (isValid(board, { ...piece, row: piece.row + 1 }))
      piece.row++;
    return piece.row;
  }
  function tryRotate(board, t, dir) {
    const newRot = (t.rotation + dir + 4) % 4;
    const candidate = { ...t, rotation: newRot };
    for (const dc of [0, -1, 1, -2, 2]) {
      const kicked = { ...candidate, col: candidate.col + dc };
      if (isValid(board, kicked))
        return kicked;
    }
    return null;
  }
  function tick(state, inputs, dt) {
    const next = {
      ...state,
      tick: state.tick + 1,
      players: state.players.map((p) => ({
        ...p,
        board: p.board.map((row) => [...row]),
        current: p.current ? { ...p.current } : null
      }))
    };
    const events = [];
    const garbageToSend = /* @__PURE__ */ new Map();
    let activePlayers = next.players.filter((p) => !p.dead);
    for (const player of activePlayers) {
      if (player.current === null)
        continue;
      const inp = inputs.get(player.id) ?? {};
      const board = player.board;
      let piece = { ...player.current };
      if (player.pendingGarbage > 0) {
        addGarbageLines(board, player.pendingGarbage, state.tick + player.id);
        player.pendingGarbage = 0;
      }
      if (inp.HOLD && !player.holdUsed) {
        player.holdUsed = true;
        const swapType = player.held ?? player.next;
        player.held = piece.type;
        if (!player.held) {
        }
        const newNext = player.held === player.next ? pickNextPiece(state, player, next.tick) : player.next;
        if (player.held === player.next)
          player.next = newNext;
        piece = spawnPiece(swapType);
        player.lockActive = false;
        player.lockTimer = 0;
        if (!isValid(board, piece)) {
          player.dead = true;
          continue;
        }
      }
      if (inp.ROTATE_CW) {
        const rotated = tryRotate(board, piece, 1);
        if (rotated) {
          piece = rotated;
          player.lockTimer = LOCK_DELAY_TICKS;
        }
      }
      if (inp.ROTATE_CCW) {
        const rotated = tryRotate(board, piece, -1);
        if (rotated) {
          piece = rotated;
          player.lockTimer = LOCK_DELAY_TICKS;
        }
      }
      if (inp.MOVE_LEFT) {
        const moved = { ...piece, col: piece.col - 1 };
        if (isValid(board, moved)) {
          piece = moved;
          player.lockTimer = LOCK_DELAY_TICKS;
        }
      }
      if (inp.MOVE_RIGHT) {
        const moved = { ...piece, col: piece.col + 1 };
        if (isValid(board, moved)) {
          piece = moved;
          player.lockTimer = LOCK_DELAY_TICKS;
        }
      }
      if (inp.HARD_DROP) {
        piece.row = hardDropRow(board, piece);
        lockPiece(board, piece);
        const cleared = clearLines(board);
        player.linesCleared += cleared;
        player.score += LINE_POINTS[cleared] * player.level;
        player.level = Math.floor(player.linesCleared / 10) + 1;
        const garbage = GARBAGE_PER_LINE[cleared];
        if (garbage > 0)
          garbageToSend.set(player.id, (garbageToSend.get(player.id) ?? 0) + garbage);
        if (cleared > 0)
          events.push({ type: "lines_cleared", playerId: player.id, count: cleared });
        piece = spawnPiece(player.next);
        player.next = pickNextPiece(state, player, next.tick);
        player.holdUsed = false;
        player.lockActive = false;
        player.lockTimer = 0;
        player.gravityAccum = 0;
        if (!isValid(board, piece)) {
          player.dead = true;
          events.push({ type: "player_dead", playerId: player.id });
          player.current = null;
          continue;
        }
        player.current = piece;
        continue;
      }
      const gravitySpeed = BASE_GRAVITY + (player.level - 1) * GRAVITY_INCREMENT;
      const softMult = inp.SOFT_DROP ? 10 : 1;
      player.gravityAccum += gravitySpeed * softMult * dt;
      let dropped = false;
      while (player.gravityAccum >= 1) {
        player.gravityAccum -= 1;
        const fallen = { ...piece, row: piece.row + 1 };
        if (isValid(board, fallen)) {
          piece = fallen;
          dropped = true;
        } else {
          player.gravityAccum = 0;
          break;
        }
      }
      const onGround = !isValid(board, { ...piece, row: piece.row + 1 });
      if (onGround) {
        if (!player.lockActive) {
          player.lockActive = true;
          player.lockTimer = LOCK_DELAY_TICKS;
        } else {
          player.lockTimer--;
        }
        if (player.lockTimer <= 0) {
          lockPiece(board, piece);
          const cleared = clearLines(board);
          player.linesCleared += cleared;
          player.score += LINE_POINTS[cleared] * player.level;
          player.level = Math.floor(player.linesCleared / 10) + 1;
          const garbage = GARBAGE_PER_LINE[cleared];
          if (garbage > 0)
            garbageToSend.set(player.id, (garbageToSend.get(player.id) ?? 0) + garbage);
          if (cleared > 0)
            events.push({ type: "lines_cleared", playerId: player.id, count: cleared });
          piece = spawnPiece(player.next);
          player.next = pickNextPiece(state, player, next.tick);
          player.holdUsed = false;
          player.lockActive = false;
          player.lockTimer = 0;
          player.gravityAccum = 0;
          if (!isValid(board, piece)) {
            player.dead = true;
            events.push({ type: "player_dead", playerId: player.id });
            player.current = null;
            continue;
          }
        }
      } else {
        player.lockActive = false;
      }
      player.current = piece;
    }
    activePlayers = next.players.filter((p) => !p.dead);
    for (const [senderId, garbageCount] of garbageToSend) {
      const targets = next.players.filter((p) => p.id !== senderId && !p.dead);
      if (targets.length === 0)
        continue;
      const perTarget = Math.floor(garbageCount / targets.length);
      const extra = garbageCount % targets.length;
      for (let i = 0; i < targets.length; i++) {
        targets[i].pendingGarbage += perTarget + (i === 0 ? extra : 0);
      }
    }
    return { state: next, events };
  }
  function pickNextPiece(state, player, currentTick) {
    const seed = state.seed + player.id * 1e4 + currentTick;
    return TETROMINO_TYPES[Math.floor(seededRandom(seed) * TETROMINO_TYPES.length)];
  }
  function isGameOver(state) {
    if (state.phase === "game_over")
      return true;
    const alive = state.players.filter((p) => !p.dead);
    if (state.players.length === 1)
      return alive.length === 0;
    return alive.length <= 1;
  }
  function getWinner(state) {
    const alive = state.players.filter((p) => !p.dead);
    if (alive.length === 1)
      return alive[0].id;
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    if (sorted[0].score === sorted[1]?.score)
      return null;
    return sorted[0].id;
  }
  var aiAdapter = {
    computeInput(state, playerId) {
      const player = state.players.find((p) => p.id === playerId);
      const inp = {
        MOVE_LEFT: false,
        MOVE_RIGHT: false,
        SOFT_DROP: false,
        HARD_DROP: false,
        ROTATE_CW: false,
        ROTATE_CCW: false,
        HOLD: false
      };
      if (!player || !player.current || player.dead)
        return inp;
      const piece = player.current;
      const board = player.board;
      let bestScore = Infinity;
      let bestCol = piece.col;
      let bestRot = piece.rotation;
      for (let rot = 0; rot < 4; rot++) {
        const candidate = { ...piece, rotation: rot };
        for (let col = 0; col < BOARD_COLS; col++) {
          const placed = { ...candidate, col };
          if (!isValid(board, placed))
            continue;
          const dropped = { ...placed, row: hardDropRow(board, placed) };
          const score = evalBoard(board, dropped);
          if (score < bestScore) {
            bestScore = score;
            bestCol = col;
            bestRot = rot;
          }
        }
      }
      if (bestRot !== piece.rotation) {
        inp.ROTATE_CW = true;
      } else if (bestCol < piece.col) {
        inp.MOVE_LEFT = true;
      } else if (bestCol > piece.col) {
        inp.MOVE_RIGHT = true;
      } else {
        inp.HARD_DROP = true;
      }
      return inp;
    }
  };
  function evalBoard(board, piece) {
    const scratch = board.map((r) => [...r]);
    const color = TETROMINO_COLORS[piece.type];
    for (const [r, c] of TETROMINO_SHAPES[piece.type][piece.rotation].map(([r2, c2]) => [piece.row + r2, piece.col + c2])) {
      if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS)
        scratch[r][c] = color;
    }
    let aggregateHeight = 0;
    let holes = 0;
    let bumpiness = 0;
    const heights = [];
    for (let c = 0; c < BOARD_COLS; c++) {
      let h = 0;
      for (let r = 0; r < BOARD_ROWS; r++) {
        if (scratch[r][c] !== null) {
          h = BOARD_ROWS - r;
          break;
        }
      }
      heights.push(h);
      aggregateHeight += h;
      let inBlock = false;
      for (let r = 0; r < BOARD_ROWS; r++) {
        if (scratch[r][c] !== null)
          inBlock = true;
        else if (inBlock)
          holes++;
      }
    }
    for (let c = 0; c < BOARD_COLS - 1; c++)
      bumpiness += Math.abs(heights[c] - heights[c + 1]);
    const completedLines = scratch.filter((row) => row.every((cell) => cell !== null)).length;
    return aggregateHeight * 0.5 + holes * 8 + bumpiness * 0.3 - completedLines * 5;
  }

  // src/games/tetromino/input.ts
  var actions = {
    MOVE_LEFT: { label: "Move Left", type: "press" },
    MOVE_RIGHT: { label: "Move Right", type: "press" },
    SOFT_DROP: { label: "Soft Drop", type: "held" },
    HARD_DROP: { label: "Hard Drop", type: "press" },
    ROTATE_CW: { label: "Rotate CW", type: "press" },
    ROTATE_CCW: { label: "Rotate CCW", type: "press" },
    HOLD: { label: "Hold Piece", type: "press" }
  };
  var defaultActionMap = {
    keyboard: {
      ArrowLeft: "MOVE_LEFT",
      KeyA: "MOVE_LEFT",
      ArrowRight: "MOVE_RIGHT",
      KeyD: "MOVE_RIGHT",
      ArrowDown: "SOFT_DROP",
      KeyS: "SOFT_DROP",
      Space: "HARD_DROP",
      ArrowUp: "ROTATE_CW",
      KeyW: "ROTATE_CW",
      KeyZ: "ROTATE_CCW",
      ShiftLeft: "HOLD",
      ShiftRight: "HOLD",
      KeyC: "HOLD"
    }
  };

  // src/framework/shared/constants.ts
  var TICK_MS = 1e3 / 60;
  var PLAYER_COLORS2 = {
    0: "#ffff00",
    1: "#ffffff",
    2: "#ff4444",
    3: "#4488ff",
    4: "#44ff88",
    5: "#ff8844",
    6: "#ff44ff",
    7: "#44ffff"
  };

  // src/games/tetromino/renderer.ts
  var CELL = 18;
  var BOARD_W = BOARD_COLS * CELL;
  var BOARD_H = BOARD_ROWS * CELL;
  var PANEL_W = BOARD_W + 60;
  var PANEL_H = BOARD_H + 40;
  var PANEL_POSITIONS = [
    { x: 20, y: 20 },
    { x: 420, y: 20 },
    { x: 20, y: 330 },
    { x: 420, y: 330 }
  ];
  function drawCell(ctx, x, y, color, size = CELL) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x + 1, y + 1, size - 2, 3);
    ctx.fillRect(x + 1, y + 1, 3, size - 2);
  }
  function drawBoard(ctx, ox, oy, board) {
    ctx.fillStyle = "#111";
    ctx.fillRect(ox, oy, BOARD_W, BOARD_H);
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= BOARD_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * CELL);
      ctx.lineTo(ox + BOARD_W, oy + r * CELL);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * CELL, oy);
      ctx.lineTo(ox + c * CELL, oy + BOARD_H);
      ctx.stroke();
    }
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const color = board[r][c];
        if (color)
          drawCell(ctx, ox + c * CELL, oy + r * CELL, color);
      }
    }
  }
  function drawPiece(ctx, ox, oy, piece, alpha = 1) {
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
  function drawGhost(ctx, ox, oy, board, piece) {
    let ghostRow = piece.row;
    while (true) {
      const next = { ...piece, row: ghostRow + 1 };
      let valid = true;
      for (const [r, c] of TETROMINO_SHAPES[next.type][next.rotation]) {
        const nr = next.row + r;
        const nc = next.col + c;
        if (nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS || board[nr]?.[nc]) {
          valid = false;
          break;
        }
      }
      if (!valid)
        break;
      ghostRow++;
    }
    if (ghostRow === piece.row)
      return;
    const ghost = { ...piece, row: ghostRow };
    drawPiece(ctx, ox, oy, ghost, 0.25);
  }
  function drawMini(ctx, cx, cy, type) {
    if (!type)
      return;
    const t = type;
    const color = TETROMINO_COLORS[t];
    const cells = TETROMINO_SHAPES[t][0];
    const miniSize = 10;
    for (const [r, c] of cells) {
      drawCell(ctx, cx + c * miniSize, cy + r * miniSize, color, miniSize);
    }
  }
  function drawPanel(ctx, player, px, py, isMe) {
    const ox = px;
    const oy = py + 22;
    ctx.fillStyle = PLAYER_COLORS2[player.id];
    ctx.font = `bold 13px monospace`;
    ctx.fillText(`${player.name} L${player.level}`, px, py + 14);
    ctx.fillStyle = "#aaa";
    ctx.font = "11px monospace";
    ctx.fillText(`${player.score}`, px + BOARD_W + 4, py + 14);
    if (player.dead) {
      drawBoard(ctx, ox, oy, player.board);
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(ox, oy, BOARD_W, BOARD_H);
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("DEAD", ox + BOARD_W / 2, oy + BOARD_H / 2);
      ctx.textAlign = "left";
      return;
    }
    drawBoard(ctx, ox, oy, player.board);
    if (player.current) {
      drawGhost(ctx, ox, oy, player.board, player.current);
      drawPiece(ctx, ox, oy, player.current);
    }
    const nextX = ox + BOARD_W + 4;
    ctx.fillStyle = "#555";
    ctx.font = "9px monospace";
    ctx.fillText("NEXT", nextX, oy + 10);
    drawMini(ctx, nextX, oy + 14, player.next);
    ctx.fillText("HOLD", nextX, oy + 70);
    drawMini(ctx, nextX, oy + 74, player.held ?? null);
    if (player.pendingGarbage > 0) {
      ctx.fillStyle = "#ff6600";
      ctx.fillRect(ox + BOARD_W - 6, oy + BOARD_H - player.pendingGarbage * CELL, 5, player.pendingGarbage * CELL);
    }
    if (isMe) {
      ctx.fillStyle = "rgba(255,255,0,0.8)";
      ctx.font = "bold 10px monospace";
      ctx.fillText("YOU", ox + BOARD_W - 28, oy - 6);
    }
  }
  var renderer = {
    render(ctx, state, myPlayerId) {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, 800, 600);
      for (let i = 0; i < state.players.length && i < 4; i++) {
        const player = state.players[i];
        const pos = PANEL_POSITIONS[i];
        drawPanel(ctx, player, pos.x, pos.y, player.id === myPlayerId);
      }
      if (state.phase === "game_over") {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, 800, 600);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 36px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", 400, 290);
        ctx.textAlign = "left";
      }
    }
  };

  // src/games/tetromino/definition.ts
  var definition = {
    id: "tetromino",
    name: "Tetromino Battle",
    description: "Competitive 4-player Tetris \u2014 clear lines to send garbage to your opponents.",
    minPlayers: 1,
    maxPlayers: 4,
    actions,
    defaultActionMap,
    createInitialState,
    tick,
    isGameOver,
    getWinner,
    renderer,
    aiAdapter,
    howToPlay: `
    <h3>Controls</h3>
    <ul>
      <li>\u2190 \u2192 Arrow keys / A D \u2014 Move</li>
      <li>\u2191 Arrow / W \u2014 Rotate clockwise</li>
      <li>Z \u2014 Rotate counter-clockwise</li>
      <li>\u2193 Arrow / S \u2014 Soft drop</li>
      <li>Space \u2014 Hard drop</li>
      <li>Shift / C \u2014 Hold piece</li>
    </ul>
    <h3>Rules</h3>
    <p>Clear 2+ lines at once to send garbage lines to all other players.
    Last player standing wins. If you fill your board to the top, you're out!</p>
    <h3>Garbage</h3>
    <ul>
      <li>2 lines \u2192 1 garbage line sent</li>
      <li>3 lines \u2192 2 garbage lines sent</li>
      <li>4 lines (Tetris) \u2192 4 garbage lines sent</li>
    </ul>
  `,
    settings: [
      {
        key: "startLevel",
        label: "Starting Level",
        type: "range",
        default: 1,
        min: 1,
        max: 15,
        step: 1
      }
    ],
    clientHooks: {
      onEvent(event) {
        if (event.type === "lines_cleared") {
          const count = event.count;
          if (count >= 4)
            console.log("TETRIS!");
        }
      }
    }
  };
  var definition_default = definition;

  // src/games/index.ts
  registerClientGame(definition_default);

  // src/client/main.ts
  var root = document.getElementById("app");
  if (!root)
    throw new Error("No #app element");
  var ui = new UIManager(root);
  ui.start();
})();
