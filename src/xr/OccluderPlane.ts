import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
import { CollisionGroup } from "../game/CollisionGroups";

export class OccluderPlane {
  private mesh: AbstractMesh;
  private scene: Scene;

  constructor(mesh: AbstractMesh, scene: Scene) {
    this.mesh = mesh;
    this.scene = scene;
    this.setupOccluderPlane();
  }

  private setupOccluderPlane() {
    const occluderMaterial = new StandardMaterial(
      "occluderMaterial",
      this.scene
    );
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
