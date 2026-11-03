import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { XRInputController } from "../xr/XRInputController";
export declare class PlayerGun {
    readonly controller: XRInputController;
    readonly target: Mesh;
    constructor(scene: Scene, controller: XRInputController, onHit: () => void);
    dispose(): void;
}
