import type { ActionSchema, ActionMap } from '../../framework/shared/types';

export const actions: ActionSchema = {
  SHIELD_LEFT:  { label: 'Shield Rotate Left',  type: 'held' },
  SHIELD_RIGHT: { label: 'Shield Rotate Right', type: 'held' },
};

export const defaultActionMap: ActionMap = {
  keyboard: {
    ArrowLeft:  'SHIELD_LEFT',
    KeyA:       'SHIELD_LEFT',
    ArrowRight: 'SHIELD_RIGHT',
    KeyD:       'SHIELD_RIGHT',
  },
  mouseWheel: {
    up: 'SHIELD_RIGHT',
    down: 'SHIELD_LEFT',
  },
  gamepad: {
    buttons: {},
    axes: { 0: 'SHIELD_RIGHT' },
  },
};

export type WarlordsInput = {
  SHIELD_LEFT: boolean;
  SHIELD_RIGHT: boolean;
};
