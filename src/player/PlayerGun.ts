import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { CollisionGroup } from "../game/CollisionGroups";
import { XRInputController } from "../xr/XRInputController";

const TARGET_DIAMETER = 0.5;

// A pistol in one hand. Its invisible sphere is what enemies and bullets hit.
export class PlayerGun {
  public readonly controller: XRInputController;
  public readonly target: Mesh;

  constructor(scene: Scene, controller: XRInputController, onHit: () => void) {
    this.controller = controller;
    controller.showModel();
    const target = MeshBuilder.CreateSphere(
      "player",
      { diameter: TARGET_DIAMETER },
      scene
    );
    target.metadata = { type: "player" };
    target.collisionGroup = CollisionGroup.PLAYER;
    target.checkCollisions = true;
    target.visibility = 0;
    const grip = controller.getMesh();
    if (grip) {
      target.parent = grip;
    }
    target.onDispose = () => {
      controller.hideModel();
      onHit();
    };
    this.target = target;
  }

  // Removes the pistol without counting it as being hit.
  public dispose(): void {
    this.target.onDispose = () => {};
    this.target.dispose();
    this.controller.hideModel();
  }
}
