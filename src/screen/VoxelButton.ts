import { Ray } from "@babylonjs/core/Culling/ray";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { VoxelText, voxelTextWidth } from "../effects/VoxelText";
import { CollisionGroup } from "../game/CollisionGroups";

const GLYPH_HEIGHT_IN_CUBES = 7;
const HIT_AREA_PADDING_IN_CUBES = 2;
const HIT_AREA_DEPTH = 0.1;
const BOB_HEIGHT = 0.02;
const BOB_SPEED = 0.002;

export type VoxelButtonOptions = {
  label: string;
  type: string;
  center: Vector3;
  cubeSize: number;
  color: Color3;
  getAimRay: () => Nullable<Ray>;
  onShot: () => void;
};

// A button you shoot, made of 3D cube letters that bob and light up when aimed at.
export class VoxelButton {
  private scene: Scene;
  private text: VoxelText;
  private hitArea: Nullable<AbstractMesh>;
  private observer: Nullable<Observer<Scene>> = null;
  private center: Vector3;
  private getAimRay: () => Nullable<Ray>;
  private shot = false;

  constructor(scene: Scene, options: VoxelButtonOptions) {
    this.scene = scene;
    this.center = options.center;
    this.getAimRay = options.getAimRay;
    this.text = new VoxelText(
      scene,
      options.label,
      options.center,
      options.cubeSize,
      options.color
    );
    this.hitArea = this.createHitArea(options);
    this.startIdleAnimation();
  }

  // The whole word is one target, so a shot between two letters still counts.
  private createHitArea(options: VoxelButtonOptions): AbstractMesh {
    const padding = HIT_AREA_PADDING_IN_CUBES * options.cubeSize;
    const hitArea = MeshBuilder.CreateBox(
      `${options.type}Button`,
      {
        width: voxelTextWidth(options.label, options.cubeSize) + padding,
        height: GLYPH_HEIGHT_IN_CUBES * options.cubeSize + padding,
        depth: HIT_AREA_DEPTH,
      },
      this.scene
    );
    hitArea.position.copyFrom(options.center);
    hitArea.isVisible = false;
    hitArea.checkCollisions = true;
    hitArea.collisionGroup = CollisionGroup.BUTTON;
    hitArea.metadata = { type: options.type };
    hitArea.onDispose = () => {
      if (this.shot) return;
      this.shot = true;
      options.onShot();
    };
    return hitArea;
  }

  private startIdleAnimation() {
    const phase = Math.random() * Math.PI * 2;
    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      const bob =
        Math.sin(performance.now() * BOB_SPEED + phase) * BOB_HEIGHT;
      this.text.moveTo(this.center.add(new Vector3(0, bob, 0)));
      this.text.setHighlighted(this.isAimedAt());
    });
  }

  private stopIdleAnimation() {
    if (this.observer) {
      this.scene.onBeforeRenderObservable.remove(this.observer);
      this.observer = null;
    }
  }

  // How far along the aim ray the button is, or null if the ray isn't on it.
  public aimedDistance(): Nullable<number> {
    if (this.shot || !this.hitArea) return null;
    const hit = this.getAimRay()?.intersectsMesh(this.hitArea);
    return hit?.hit ? hit.distance : null;
  }

  public isAimedAt(): boolean {
    return this.aimedDistance() !== null;
  }

  // Does what a bullet does, for games with no pistol. Returns whether it pressed the button.
  // Removing the hit area is what fires onShot, once, whichever of them gets there first.
  public press(): boolean {
    if (this.shot || !this.hitArea) return false;
    this.hitArea.dispose();
    return true;
  }

  // Stops the button responding to shots.
  public disable() {
    if (this.hitArea) {
      this.hitArea.onDispose = () => {};
      this.hitArea.dispose();
      this.hitArea = null;
    }
  }

  public burst(onDone: () => void) {
    this.stopIdleAnimation();
    this.hitArea = null;
    this.text.burst(onDone);
  }

  public dispose() {
    this.stopIdleAnimation();
    this.disable();
    this.text.dispose();
  }
}
