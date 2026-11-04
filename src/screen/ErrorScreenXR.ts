import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { UIText } from "../game/UITextMesh";

const MESSAGE_DISTANCE = 1.5;

// Stays in front of the player, who may not be looking at any particular spot.
export class ErrorScreenXR {
  private scene: Scene;
  private error: Error;
  private mesh: AbstractMesh | null = null;
  private observer: Nullable<Observer<Scene>> = null;

  constructor(scene: Scene, error: Error) {
    this.scene = scene;
    this.error = error;
    this.createErrorScreenVR();
  }

  private createErrorScreenVR(): void {
    const textBlock = UIText.createTextBlock(this.error.message, 36, "red");
    textBlock.textWrapping = true;
    const mesh = UIText.createTextMesh(
      this.scene,
      "error",
      textBlock,
      { minX: -2, maxX: 2, minY: 0.5, maxY: 1, minZ: 1, maxZ: 1 }
    ).mesh;
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.mesh = mesh;
    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      const camera = this.scene.activeCamera;
      if (camera) {
        // The mesh has no parent, so it needs where the head is in the world, which isn't
        // the camera's own position once the world has turned.
        const ray = camera.getForwardRay(100, undefined, camera.globalPosition);
        mesh.position.copyFrom(
          ray.origin.add(ray.direction.scale(MESSAGE_DISTANCE))
        );
      }
    });
  }

  public dispose(): void {
    if (this.observer) {
      this.scene.onBeforeRenderObservable.remove(this.observer);
      this.observer = null;
    }
    if (this.mesh) {
      this.mesh.dispose(false, true);
      this.mesh = null;
    }
  }
}
