// Per-frame speeds were tuned on a 72 Hz headset. This scales them so the game
// runs at that speed at any refresh rate.
const TUNED_FPS = 72;
// Stops one long frame, such as after a pause, from jumping everything forward.
const MAX_FRAME_SCALE = 3;
export function frameScale(scene) {
    return Math.min(
    // The animation ratio is 1 at 60 fps, which makes this 1 at TUNED_FPS.
    (scene.getAnimationRatio() * TUNED_FPS) / 60, MAX_FRAME_SCALE);
}
