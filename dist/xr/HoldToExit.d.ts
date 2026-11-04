import { Scene } from "@babylonjs/core/scene";
import { XREnvironment } from "./XREnvironment";
export type HoldToExitOptions = {
    xrEnvironment: XREnvironment;
    scene: Scene;
    onExit: () => void;
};
export declare class HoldToExit {
    private options;
    private scene;
    private timer;
    private observer;
    private node;
    private text;
    private fill;
    private track;
    private fillMaterial;
    private trackMaterial;
    private shown;
    private disposed;
    constructor(options: HoldToExitOptions);
    private barMaterial;
    private bar;
    private tick;
    private placeInFrontOfHead;
    private showProgress;
    dispose(): void;
}
