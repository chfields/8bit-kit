import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
export declare function voxelTextWidth(text: string, cubeSize: number): number;
export declare function voxelTextHeight(cubeSize: number): number;
export declare class VoxelText {
    private scene;
    private node;
    private template;
    private cubes;
    private observer;
    private material;
    private color;
    private highlighted;
    constructor(scene: Scene, text: string, center: Vector3, cubeSize: number, color: Color3, popIn?: boolean);
    private buildCubes;
    private popIn;
    attachTo(parent: TransformNode): void;
    setVisible(visible: boolean): void;
    moveTo(center: Vector3): void;
    setHighlighted(highlighted: boolean): void;
    burst(onDone: () => void): void;
    dispose(): void;
}
