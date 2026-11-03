import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
import { CollisionGroup } from "../game/CollisionGroups";

export class OccluderPlane {
  private mesh: AbstractMesh;
  private scene: Scene;

  // Solid surfaces also hide the portal's bar, glow and smoke. Walls can't be solid, because
  // the portal reaches the room's corners and they would hide its smoke.
  constructor(mesh: AbstractMesh, scene: Scene, solid: boolean = false) {
    this.mesh = mesh;
    this.scene = scene;
    this.setupOccluderPlane(solid);
  }

  private setupOccluderPlane(solid: boolean) {
    const occluderMaterial = new StandardMaterial(
      "occluderMaterial",
      this.scene
    );
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
