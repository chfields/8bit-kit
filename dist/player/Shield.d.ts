import { XRInputController } from "../xr/XRInputController";
import { Scene } from "@babylonjs/core/scene";
export declare const SHIELD_DURATION_MS = 3000;
export declare class Shield {
    private scene;
    private shieldMesh;
    private shieldMaterial;
    private observer;
    constructor(scene: Scene, controller: XRInputController | null);
    private createShield;
    private startShieldLoop;
    dispose(): void;
}
