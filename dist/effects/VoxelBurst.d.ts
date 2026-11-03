import { Color3 } from "@babylonjs/core/Maths/math.color";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
export declare function meshColor(mesh: AbstractMesh): Color3;
export declare class VoxelBurst {
    private scene;
    private template;
    private cubes;
    private velocities;
    private observer;
    constructor(scene: Scene, mesh: AbstractMesh, fraction?: number);
    private start;
    dispose(): void;
}
