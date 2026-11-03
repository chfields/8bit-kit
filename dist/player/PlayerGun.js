import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { CollisionGroup } from "../game/CollisionGroups";
const TARGET_DIAMETER = 0.5;
// A pistol in one hand. Its invisible sphere is what enemies and bullets hit.
export class PlayerGun {
    constructor(scene, controller, onHit) {
        Object.defineProperty(this, "controller", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "target", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.controller = controller;
        controller.showModel();
        const target = MeshBuilder.CreateSphere("player", { diameter: TARGET_DIAMETER }, scene);
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
    dispose() {
        this.target.onDispose = () => { };
        this.target.dispose();
        this.controller.hideModel();
    }
}
