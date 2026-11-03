import { XRInputController } from "../xr/XRInputController";
import { CollisionGroup } from "../game/CollisionGroups";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";

export const SHIELD_DURATION_MS = 3000;
const SHIELD_START_ALPHA = 0.4;

export class Shield {
  private scene: Scene;
  private shieldMesh: Nullable<Mesh> = null;
  private shieldMaterial: Nullable<StandardMaterial> = null;
  private observer: Nullable<Observer<Scene>> = null;

  constructor(scene: Scene, controller: XRInputController | null) {
    this.scene = scene;
    const grip = controller?.getMesh();
    if (grip) {
      this.createShield(grip);
    }
  }

  private createShield(grip: AbstractMesh) {
    const shield = MeshBuilder.CreateSphere(
      "sphere",
      { diameter: 1, arc: 0.5, sideOrientation: Mesh.DOUBLESIDE },
      this.scene
    );
    // The dome stays facing the aliens however the controller is held, so it
    // follows the grip's position but isn't parented to it.
    shield.rotate(new Vector3(1, 0, 0), Math.PI);
    shield.position.copyFrom(grip.getAbsolutePosition());

    shield.checkCollisions = true;
    shield.collisionGroup = CollisionGroup.PLAYER;
    shield.metadata = { type: "shield" };
    // light blue transparent material
    const material = new StandardMaterial("shieldMaterial", this.scene);
    material.alpha = SHIELD_START_ALPHA;
    material.emissiveColor = Color3.Blue();
    shield.material = material;

    this.shieldMaterial = material;
    this.shieldMesh = shield;
    this.startShieldLoop(grip);
  }

  // Protection lasts as long as the fade, so it's visible when it runs out.
  private startShieldLoop(grip: AbstractMesh) {
    const startTime = performance.now();
    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.shieldMesh || !this.shieldMaterial) return;
      const progress = (performance.now() - startTime) / SHIELD_DURATION_MS;
      if (progress >= 1) {
        this.dispose();
        return;
      }
      this.shieldMesh.position.copyFrom(grip.getAbsolutePosition());
      this.shieldMaterial.alpha = SHIELD_START_ALPHA * (1 - progress);
    });
  }

  public dispose() {
    if (this.shieldMesh) {
      this.shieldMesh.dispose();
      this.shieldMesh = null;
    }
    if (this.shieldMaterial) {
      this.shieldMaterial.dispose();
      this.shieldMaterial = null;
    }
    if (this.observer) {
      this.scene.onBeforeRenderObservable.remove(this.observer);
      this.observer = null;
    }
  }
}
