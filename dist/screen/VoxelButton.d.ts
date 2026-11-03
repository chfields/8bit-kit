import { Ray } from "@babylonjs/core/Culling/ray";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
export type VoxelButtonOptions = {
    label: string;
    type: string;
    center: Vector3;
    cubeSize: number;
    color: Color3;
    getAimRay: () => Nullable<Ray>;
    onShot: () => void;
};
export declare class VoxelButton {
    private scene;
    private text;
    private hitArea;
    private observer;
    private center;
    private getAimRay;
    constructor(scene: Scene, options: VoxelButtonOptions);
    private createHitArea;
    private startIdleAnimation;
    private stopIdleAnimation;
    disable(): void;
    burst(onDone: () => void): void;
    dispose(): void;
}
