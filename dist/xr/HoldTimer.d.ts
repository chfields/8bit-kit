export type HoldState = {
    visible: boolean;
    progress: number;
    done: boolean;
};
export declare class HoldTimer {
    private holdMs;
    private showAfterMs;
    private pressedAt;
    constructor(holdMs: number, showAfterMs: number);
    update(pressed: boolean, now: number): HoldState;
}
