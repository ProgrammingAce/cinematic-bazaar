import type { ActionSchema, ActionMap, BaseInput } from '../../shared/types';

export class InputHandler {
  private heldKeys = new Set<string>();
  private pressedKeys = new Set<string>();
  private schema: ActionSchema = {};
  private actionMap: ActionMap = { keyboard: {} };
  private wheelActions: { up?: string; down?: string } = {};

  init(schema: ActionSchema, actionMap: ActionMap): void {
    this.schema = schema;
    this.actionMap = actionMap;
    this.wheelActions = actionMap.mouseWheel ?? {};
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('wheel', this.onWheel);
    this.heldKeys.clear();
    this.pressedKeys.clear();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.heldKeys.add(e.code);
    this.pressedKeys.add(e.code);
    // Prevent scrolling with arrow keys
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private onWheel = (e: WheelEvent): void => {
    if (e.deltaY < 0 && this.wheelActions.up) this.pressedKeys.add('__wheel_up__');
    if (e.deltaY > 0 && this.wheelActions.down) this.pressedKeys.add('__wheel_down__');
  };

  // Call once per frame after sending input to consume press events
  flush(): void {
    this.pressedKeys.clear();
  }

  getInput(): BaseInput {
    const input: BaseInput = {};
    const km = this.actionMap.keyboard;

    for (const [code, action] of Object.entries(km)) {
      const desc = this.schema[action];
      if (!desc) continue;
      if (desc.type === 'held' && this.heldKeys.has(code)) {
        input[action] = true;
      } else if (desc.type === 'press' && this.pressedKeys.has(code)) {
        input[action] = true;
      }
    }

    if (this.wheelActions.up && this.pressedKeys.has('__wheel_up__')) input[this.wheelActions.up] = true;
    if (this.wheelActions.down && this.pressedKeys.has('__wheel_down__')) input[this.wheelActions.down] = true;

    return input;
  }
}
