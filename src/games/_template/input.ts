import type { ActionSchema, ActionMap } from '../../framework/shared/types';

// Declare every action the game reads. type:'held' = true while key held;
// type:'press' = true only on the frame the key is first pressed.
export const actions: ActionSchema = {
  MOVE_LEFT:  { label: 'Move Left',  type: 'held' },
  MOVE_RIGHT: { label: 'Move Right', type: 'held' },
  MOVE_UP:    { label: 'Move Up',    type: 'held' },
  MOVE_DOWN:  { label: 'Move Down',  type: 'held' },
  ACTION:     { label: 'Action',     type: 'press' },
  // TODO: add or remove actions to match your game
};

// Map KeyboardEvent.code values to action names.
export const defaultActionMap: ActionMap = {
  keyboard: {
    ArrowLeft:  'MOVE_LEFT',  KeyA: 'MOVE_LEFT',
    ArrowRight: 'MOVE_RIGHT', KeyD: 'MOVE_RIGHT',
    ArrowUp:    'MOVE_UP',    KeyW: 'MOVE_UP',
    ArrowDown:  'MOVE_DOWN',  KeyS: 'MOVE_DOWN',
    Space:      'ACTION',     KeyE: 'ACTION',
  },
  // mouseWheel: { up: 'PREV', down: 'NEXT' },
};

// Must mirror every key in `actions` above, typed as boolean or number.
export type TemplateInput = {
  MOVE_LEFT:  boolean;
  MOVE_RIGHT: boolean;
  MOVE_UP:    boolean;
  MOVE_DOWN:  boolean;
  ACTION:     boolean;
};
