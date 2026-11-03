import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VoxelText, voxelTextWidth } from "../effects/VoxelText";
import { CollisionGroup } from "../game/CollisionGroups";
const GLYPH_HEIGHT_IN_CUBES = 7;
const HIT_AREA_PADDING_IN_CUBES = 2;
const HIT_AREA_DEPTH = 0.1;
const BOB_HEIGHT = 0.02;
const BOB_SPEED = 0.002;
// A button you shoot, made of 3D cube letters that bob and light up when aimed at.
export class VoxelButton {
    constructor(scene, options) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "text", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hitArea", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "observer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "center", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "getAimRay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.scene = scene;
        this.center = options.center;
        this.getAimRay = options.getAimRay;
        this.text = new VoxelText(scene, options.label, options.center, options.cubeSize, options.color);
        this.hitArea = this.createHitArea(options);
        this.startIdleAnimation();
    }
    // The whole word is one target, so a shot between two letters still counts.
    createHitArea(options) {
        const padding = HIT_AREA_PADDING_IN_CUBES * options.cubeSize;
        const hitArea = MeshBuilder.CreateBox(`${options.type}Button`, {
            width: voxelTextWidth(options.label, options.cubeSize) + padding,
            height: GLYPH_HEIGHT_IN_CUBES * options.cubeSize + padding,
            depth: HIT_AREA_DEPTH,
        }, this.scene);
        hitArea.position.copyFrom(options.center);
        hitArea.isVisible = false;
        hitArea.checkCollisions = true;
        hitArea.collisionGroup = CollisionGroup.BUTTON;
        hitArea.metadata = { type: options.type };
        hitArea.onDispose = () => options.onShot();
        return hitArea;
    }
    startIdleAnimation() {
        const phase = Math.random() * Math.PI * 2;
        this.observer = this.scene.onBeforeRenderObservable.add(() => {
            const bob = Math.sin(performance.now() * BOB_SPEED + phase) * BOB_HEIGHT;
            this.text.moveTo(this.center.add(new Vector3(0, bob, 0)));
            const ray = this.getAimRay();
            const aimedAt = !!(ray &&
                this.hitArea &&
                ray.intersectsMesh(this.hitArea).hit);
            this.text.setHighlighted(aimedAt);
        });
    }
    stopIdleAnimation() {
        if (this.observer) {
            this.scene.onBeforeRenderObservable.remove(this.observer);
            this.observer = null;
        }
    }
    // Stops the button responding to shots.
    disable() {
        if (this.hitArea) {
            this.hitArea.onDispose = () => { };
            this.hitArea.dispose();
            this.hitArea = null;
        }
    }
    burst(onDone) {
        this.stopIdleAnimation();
        this.hitArea = null;
        this.text.burst(onDone);
    }
    dispose() {
        this.stopIdleAnimation();
        this.disable();
        this.text.dispose();
    }
}
