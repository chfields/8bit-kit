import { CollisionGroup } from "../game/CollisionGroups";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
export const SHIELD_DURATION_MS = 3000;
const SHIELD_START_ALPHA = 0.4;
export class Shield {
    constructor(scene, controller) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "shieldMesh", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "shieldMaterial", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "observer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.scene = scene;
        const grip = controller?.getMesh();
        if (grip) {
            this.createShield(grip);
        }
    }
    createShield(grip) {
        const shield = MeshBuilder.CreateSphere("sphere", { diameter: 1, arc: 0.5, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
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
    startShieldLoop(grip) {
        const startTime = performance.now();
        this.observer = this.scene.onBeforeRenderObservable.add(() => {
            if (!this.shieldMesh || !this.shieldMaterial)
                return;
            const progress = (performance.now() - startTime) / SHIELD_DURATION_MS;
            if (progress >= 1) {
                this.dispose();
                return;
            }
            this.shieldMesh.position.copyFrom(grip.getAbsolutePosition());
            this.shieldMaterial.alpha = SHIELD_START_ALPHA * (1 - progress);
        });
    }
    dispose() {
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
