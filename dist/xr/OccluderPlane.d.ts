import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
export declare class OccluderPlane {
    private mesh;
    private scene;
    constructor(mesh: AbstractMesh, scene: Scene, solid?: boolean);
    private setupOccluderPlane;
}
