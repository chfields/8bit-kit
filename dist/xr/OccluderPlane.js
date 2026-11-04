import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CollisionGroup } from "../game/CollisionGroups";
export class OccluderPlane {
    // Solid surfaces also hide the portal's bar, glow and smoke. Walls can't be solid, because
    // the portal reaches the room's corners and they would hide its smoke.
    constructor(mesh, scene, solid = false) {
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
        this.setupOccluderPlane(solid);
    }
    setupOccluderPlane(solid) {
        const occluderMaterial = new StandardMaterial("occluderMaterial", this.scene);
        occluderMaterial.disableLighting = true;
        occluderMaterial.forceDepthWrite = true;
        // Depth only: drawn before the smoke, and opaque to Babylon so the glow pass draws it.
        occluderMaterial.disableColorWrite = solid;
        this.mesh.material = occluderMaterial;
        this.mesh.visibility = solid ? 1 : 0.001;
        this.mesh.renderingGroupId = 0;
        this.mesh.metadata = {
            type: "occluder",
            solid,
        };
        this.mesh.checkCollisions = true;
        this.mesh.collisionGroup = CollisionGroup.ROOM;
    }
}
