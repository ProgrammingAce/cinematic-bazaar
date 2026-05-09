import type { ActionSchema, ActionMap } from '../../framework/shared/types';

export const actions: ActionSchema = {
  MOVE_LEFT:   { label: 'Move Left',    type: 'press' },
  MOVE_RIGHT:  { label: 'Move Right',   type: 'press' },
  SOFT_DROP:   { label: 'Soft Drop',    type: 'held' },
  HARD_DROP:   { label: 'Hard Drop',    type: 'press' },
  ROTATE_CW:   { label: 'Rotate CW',   type: 'press' },
  ROTATE_CCW:  { label: 'Rotate CCW',  type: 'press' },
  HOLD:        { label: 'Hold Piece',   type: 'press' },
};

export const defaultActionMap: ActionMap = {
  keyboard: {
    ArrowLeft:  'MOVE_LEFT',
    KeyA:       'MOVE_LEFT',
    ArrowRight: 'MOVE_RIGHT',
    KeyD:       'MOVE_RIGHT',
    ArrowDown:  'SOFT_DROP',
    KeyS:       'SOFT_DROP',
    Space:      'HARD_DROP',
    ArrowUp:    'ROTATE_CW',
    KeyW:       'ROTATE_CW',
    KeyZ:       'ROTATE_CCW',
    ShiftLeft:  'HOLD',
    ShiftRight: 'HOLD',
    KeyC:       'HOLD',
  },
};

export type TetrominoInput = {
  MOVE_LEFT: boolean;
  MOVE_RIGHT: boolean;
  SOFT_DROP: boolean;
  HARD_DROP: boolean;
  ROTATE_CW: boolean;
  ROTATE_CCW: boolean;
  HOLD: boolean;
};
