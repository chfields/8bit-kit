import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VoxelBurst } from "../effects/VoxelBurst";
import { NeonColor3 } from "../effects/Colors";
import { frameScale } from "../game/FrameScale";
import { CollisionGroup } from "../game/CollisionGroups";
// A hit that doesn't destroy its target makes a smaller burst.
const HIT_BURST_SIZE = 0.35;
export class PlayerBullet {
    // Each game calls this once at startup, before anything fires.
    static configure(options) {
        PlayerBullet.options = options;
    }
    constructor(scene, assetManager, controllerRay) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "controllerRay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bullet", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bulletObserver", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "bulletSpeed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0.2
        });
        Object.defineProperty(this, "maxDistance", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 50
        });
        Object.defineProperty(this, "distanceTravelled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "gameAssetManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
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
    createBullet() {
        const box = MeshBuilder.CreateBox("bullet", { width: 0.02, height: 0.02, depth: 0.5 }, this.scene);
        box.ellipsoid = new Vector3(0.02, 0.02, 0.02);
        return box;
    }
    startBulletLoop() {
        this.bullet.position = this.controllerRay.origin.clone();
        // offset the bullet position by 0.5 in the direction of the ray
        this.bullet.position.addInPlace(this.controllerRay.direction.clone().scaleInPlace(0.25));
        // rotation should be perpendicular to the controller ray
        this.bullet.setDirection(this.controllerRay.direction.clone());
        this.bulletObserver = this.scene.onBeforeRenderObservable.add(() => {
            if (!this.bullet)
                return;
            const distance = this.bulletSpeed * frameScale(this.scene);
            this.bullet?.moveWithCollisions(this.controllerRay.direction.clone().scaleInPlace(distance));
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
    handleCollision() {
        const collidedMesh = this.bullet.collider?.collidedMesh;
        if (!collidedMesh)
            return;
        let collidedWithType = collidedMesh?.metadata?.type;
        if (collidedMesh.metadata?.lives > 0) {
            collidedMesh.metadata.lives -= 1;
            collidedMesh.metadata.onHit?.();
            new VoxelBurst(this.scene, collidedMesh, HIT_BURST_SIZE);
            this.gameAssetManager.playSound("alien-explosion", collidedMesh);
            this.destroyBullet();
            return;
        }
        const { destroys, onCollision } = PlayerBullet.options;
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
    destroyBullet() {
        this.scene.onBeforeRenderObservable.remove(this.bulletObserver);
        this.bullet?.dispose(false, true);
        this.disposed = true;
    }
}
Object.defineProperty(PlayerBullet, "options", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
