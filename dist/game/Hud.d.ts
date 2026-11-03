import { Scene } from "@babylonjs/core/scene";
import { XRRange } from "../xr/XREnvironment";
export declare class Hud {
    private scene;
    private xrRange;
    private cubeSize;
    private score;
    private lives;
    private level;
    private flashTimer;
    constructor(scene: Scene, range: XRRange, options: {
        longestText: string;
    });
    private createItem;
    private replaceItem;
    updateScore(score: number): void;
    updateLives(lives: number): void;
    updateLevel(level: number): void;
    flashLives(): void;
    private stopFlash;
    dispose(): void;
}
