import { Scene } from "@babylonjs/core/scene";
export declare class ErrorScreenXR {
    private scene;
    private error;
    private mesh;
    private observer;
    constructor(scene: Scene, error: Error);
    private createErrorScreenVR;
    dispose(): void;
}
