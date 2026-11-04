const RELEASED = { visible: false, progress: 0, done: false };
// Tracks a button being held down. Rules only, with no Babylon imports.
export class HoldTimer {
    constructor(holdMs, showAfterMs) {
        Object.defineProperty(this, "holdMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "showAfterMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pressedAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.holdMs = holdMs;
        this.showAfterMs = showAfterMs;
    }
    update(pressed, now) {
        if (!pressed) {
            this.pressedAt = null;
            return RELEASED;
        }
        if (this.pressedAt === null)
            this.pressedAt = now;
        const held = now - this.pressedAt;
        return {
            visible: held >= this.showAfterMs,
            progress: Math.min(held / this.holdMs, 1),
            done: held >= this.holdMs,
        };
    }
}
