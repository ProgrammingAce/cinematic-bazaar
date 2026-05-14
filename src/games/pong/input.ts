import type { ActionSchema, ActionMap } from '../../framework/shared/types';

export const actions: ActionSchema = {
  MOVE_UP:   { label: 'Move Up',   type: 'held' },
  MOVE_DOWN: { label: 'Move Down', type: 'held' },
};

export const defaultActionMap: ActionMap = {
  keyboard: {
    ArrowUp:   'MOVE_UP',
    KeyW:      'MOVE_UP',
    ArrowDown: 'MOVE_DOWN',
    KeyS:      'MOVE_DOWN',
  },
};

export type PongInput = {
  MOVE_UP:   boolean;
  MOVE_DOWN: boolean;
};
