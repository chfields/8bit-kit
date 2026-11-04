export type HoldState = {
  visible: boolean;
  // 0 to 1, from the press to the end of the hold.
  progress: number;
  done: boolean;
};

const RELEASED: HoldState = { visible: false, progress: 0, done: false };

// Tracks a button being held down. Rules only, with no Babylon imports.
export class HoldTimer {
  private holdMs: number;
  private showAfterMs: number;
  private pressedAt: number | null = null;

  constructor(holdMs: number, showAfterMs: number) {
    this.holdMs = holdMs;
    this.showAfterMs = showAfterMs;
  }

  public update(pressed: boolean, now: number): HoldState {
    if (!pressed) {
      this.pressedAt = null;
      return RELEASED;
    }
    if (this.pressedAt === null) this.pressedAt = now;
    const held = now - this.pressedAt;
    return {
      visible: held >= this.showAfterMs,
      progress: Math.min(held / this.holdMs, 1),
      done: held >= this.holdMs,
    };
  }
}
