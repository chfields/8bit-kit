import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CollisionGroup } from "../game/CollisionGroups";
export class OccluderPlane {
    constructor(mesh, scene) {
        Object.defineProperty(this, "mesh", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.mesh = mesh;
        this.scene = scene;
        this.setupOccluderPlane();
    }
    setupOccluderPlane() {
        const occluderMaterial = new StandardMaterial("occluderMaterial", this.scene);
        occluderMaterial.disableLighting = true;
        occluderMaterial.forceDepthWrite = true;
        this.mesh.material = occluderMaterial;
        this.mesh.visibility = 0.001;
        this.mesh.renderingGroupId = 0;
        this.mesh.metadata = {
            type: "occluder",
        };
        this.mesh.checkCollisions = true;
        this.mesh.collisionGroup = CollisionGroup.ROOM;
    }
}
