// Board dimensions per player panel
export const BOARD_COLS = 10;
export const BOARD_ROWS = 20;

// Each cell in pixels (panels rendered at reduced size to fit 4 on 800×600)
export const CELL_SIZE = 18;

// Panel layout: 4 panels side by side
export const PANEL_WIDTH = BOARD_COLS * CELL_SIZE;   // 180
export const PANEL_HEIGHT = BOARD_ROWS * CELL_SIZE;  // 360

// Gravity: rows dropped per second at level 1; increases with level
export const BASE_GRAVITY = 1.0;
export const GRAVITY_INCREMENT = 0.3;

// Points
export const LINE_POINTS = [0, 100, 300, 500, 800];
export const GARBAGE_PER_LINE = [0, 0, 1, 2, 4]; // lines sent to opponents

// Lock delay in ticks (~30 frames = 0.5s at 60Hz)
export const LOCK_DELAY_TICKS = 30;

// Tetromino shapes (4×4 bitmask rows, 0-indexed from top)
export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export const TETROMINO_SHAPES: Record<TetrominoType, number[][][]> = {
  // Each entry: [rotation0, rotation1, rotation2, rotation3], each rotation is array of [row, col] offsets
  I: [
    [[1,0],[1,1],[1,2],[1,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,1],[1,1],[2,1],[3,1]],
  ],
  O: [
    [[0,1],[0,2],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[1,2]],
  ],
  T: [
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[2,1]],
  ],
  S: [
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,1],[1,2],[2,0],[2,1]],
    [[0,0],[1,0],[1,1],[2,1]],
  ],
  Z: [
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,2],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[0,1],[1,0],[1,1],[2,0]],
  ],
  J: [
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,0],[2,1]],
  ],
  L: [
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[1,2],[2,0]],
    [[0,0],[0,1],[1,1],[2,1]],
  ],
};

export const TETROMINO_COLORS: Record<TetrominoType, string> = {
  I: '#00ffff',
  O: '#ffff00',
  T: '#aa00ff',
  S: '#00ff00',
  Z: '#ff0000',
  J: '#0000ff',
  L: '#ff8800',
};

export const TETROMINO_TYPES: TetrominoType[] = ['I','O','T','S','Z','J','L'];
