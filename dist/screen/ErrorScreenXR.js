import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { UIText } from "../game/UITextMesh";
const MESSAGE_DISTANCE = 1.5;
// Stays in front of the player, who may not be looking at any particular spot.
export class ErrorScreenXR {
    constructor(scene, error) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "error", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "mesh", {
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
        this.error = error;
        this.createErrorScreenVR();
    }
    createErrorScreenVR() {
        const textBlock = UIText.createTextBlock(this.error.message, 36, "red");
        textBlock.textWrapping = true;
        const mesh = UIText.createTextMesh(this.scene, "error", textBlock, { minX: -2, maxX: 2, minY: 0.5, maxY: 1, minZ: 1, maxZ: 1 }).mesh;
        mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
        this.mesh = mesh;
        this.observer = this.scene.onBeforeRenderObservable.add(() => {
            const camera = this.scene.activeCamera;
            if (camera) {
                // The mesh has no parent, so it needs where the head is in the world, which isn't
                // the camera's own position once the world has turned.
                const ray = camera.getForwardRay(100, undefined, camera.globalPosition);
                mesh.position.copyFrom(ray.origin.add(ray.direction.scale(MESSAGE_DISTANCE)));
            }
        });
    }
    dispose() {
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
