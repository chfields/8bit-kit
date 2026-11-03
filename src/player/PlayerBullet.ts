import { Ray } from "@babylonjs/core/Culling/ray";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { GameAssetManager } from "../assets/GameAssetManager";
import { VoxelBurst } from "../effects/VoxelBurst";
import { NeonColor3 } from "../effects/Colors";
import { frameScale } from "../game/FrameScale";
import { CollisionGroup } from "../game/CollisionGroups";

// A hit that doesn't destroy its target makes a smaller burst.
const HIT_BURST_SIZE = 0.35;

export type PlayerBulletOptions = {
  // The groups a shot collides with.
  collisionMask: number;
  // The mesh types a shot destroys.
  destroys: string[];
  // Runs first for anything else a shot hits. Return true if the hit is handled.
  onCollision?: (mesh: AbstractMesh) => boolean;
};

export class PlayerBullet {
  private static options: PlayerBulletOptions | null = null;

  // Each game calls this once at startup, before anything fires.
  public static configure(options: PlayerBulletOptions): void {
    PlayerBullet.options = options;
  }

  private scene: Scene;
  private controllerRay: Ray;
  private bullet: AbstractMesh;
  private bulletObserver: Nullable<Observer<Scene>> = null;
  private bulletSpeed = 0.2;
  private maxDistance = 50;
  private distanceTravelled = 0;
  private gameAssetManager: GameAssetManager;
  public disposed = false;

  public constructor(
    scene: Scene,
    assetManager: GameAssetManager,
    controllerRay: Ray
  ) {
    if (!PlayerBullet.options) {
      throw new Error("PlayerBullet.configure must be called first");
    }
    this.scene = scene;
    this.controllerRay = controllerRay;
    this.bullet = this.createBullet();

    // set the material of the bullet to red
    const material = new StandardMaterial("pbrMaterial", scene);
    material.emissiveColor = NeonColor3;
    material.disableLighting = true;
    this.bullet.material = material;

    this.bullet.metadata = { type: "playerbullet" };
    this.bullet.collisionGroup = CollisionGroup.PLAYER_BULLET;
    this.bullet.collisionMask = PlayerBullet.options.collisionMask;

    // add sound here later
    this.gameAssetManager = assetManager;
    this.gameAssetManager.playSound("laser");
    this.startBulletLoop();
  }

  private createBullet(): AbstractMesh {
    const box = MeshBuilder.CreateBox(
      "bullet",
      { width: 0.02, height: 0.02, depth: 0.5 },
      this.scene
    );
    box.ellipsoid = new Vector3(0.02, 0.02, 0.02);
    return box;
  }

  private startBulletLoop(): void {
    this.bullet.position = this.controllerRay.origin.clone();
    // offset the bullet position by 0.5 in the direction of the ray
    this.bullet.position.addInPlace(
      this.controllerRay.direction.clone().scaleInPlace(0.25)
    );

    // rotation should be perpendicular to the controller ray
    this.bullet.setDirection(this.controllerRay.direction.clone());

    this.bulletObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.bullet) return;
      const distance = this.bulletSpeed * frameScale(this.scene);
      this.bullet?.moveWithCollisions(
        this.controllerRay.direction.clone().scaleInPlace(distance)
      );
      this.distanceTravelled += distance;
      if (this.distanceTravelled > this.maxDistance) {
        this.destroyBullet();
        return;
      }
      if (this.bullet.collider?.collidedMesh) {
        this.handleCollision();
      }
      this.bullet.checkCollisions = true;
    });
  }

  private handleCollision(): void {
    const collidedMesh = this.bullet.collider?.collidedMesh;
    if (!collidedMesh) return;
    let collidedWithType = collidedMesh?.metadata?.type;

    if (collidedMesh.metadata?.lives > 0) {
      collidedMesh.metadata.lives -= 1;
      collidedMesh.metadata.onHit?.();
      new VoxelBurst(this.scene, collidedMesh, HIT_BURST_SIZE);
      this.gameAssetManager.playSound("alien-explosion", collidedMesh);
      this.destroyBullet();
      return;
    }
    const { destroys, onCollision } = PlayerBullet.options!;
    if (onCollision?.(collidedMesh)) {
      this.destroyBullet();
      return;
    }

    if (destroys.includes(collidedWithType)) {
      collidedMesh?.dispose();
      this.destroyBullet();
      return;
    }

    if (collidedWithType === "occluder") {
      this.destroyBullet();
    }
  }

  private destroyBullet(): void {
    this.scene.onBeforeRenderObservable.remove(this.bulletObserver);
    this.bullet?.dispose(false, true);
    this.disposed = true;
  }
}
