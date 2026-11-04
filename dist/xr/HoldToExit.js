import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VoxelText } from "../effects/VoxelText";
import { HoldTimer } from "./HoldTimer";
const HOLD_MS = 2000;
// A brief press shows nothing.
const SHOW_AFTER_MS = 250;
// Close enough to be in front of most walls, and over the 0.5 m comfort limit.
const DISTANCE_FROM_HEAD = 0.8;
const BELOW_EYES = 0.1;
const TEXT = "HOLD TO EXIT";
const TEXT_CUBE_SIZE = 0.008;
const TEXT_ABOVE_BAR = 0.06;
const BAR_WIDTH = 0.5;
const BAR_HEIGHT = 0.02;
const BAR_DEPTH = 0.01;
const MIN_FILL = 0.001;
const COLOR = new Color3(1, 0.3, 0.2);
const TRACK_COLOR = new Color3(0.15, 0.05, 0.05);
// Holding X on the left controller leaves the session, with a bar showing how long is left.
// A game creates one when XR starts, and disposes it when XR ends.
export class HoldToExit {
    constructor(options) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "timer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new HoldTimer(HOLD_MS, SHOW_AFTER_MS)
        });
        Object.defineProperty(this, "observer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "node", {
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
        Object.defineProperty(this, "fill", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "track", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "fillMaterial", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "trackMaterial", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "shown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.options = options;
        this.scene = options.scene;
        // Built now, hidden, so nothing is created while creatures are in play.
        this.node = new TransformNode("holdToExit", this.scene);
        this.text = new VoxelText(this.scene, TEXT, Vector3.Zero(), TEXT_CUBE_SIZE, COLOR, false);
        this.text.attachTo(this.node);
        this.text.moveTo(new Vector3(0, TEXT_ABOVE_BAR, 0));
        this.trackMaterial = this.barMaterial("holdToExitTrackMaterial", TRACK_COLOR);
        this.fillMaterial = this.barMaterial("holdToExitBarMaterial", COLOR);
        this.track = this.bar("holdToExitTrack", this.trackMaterial);
        this.fill = this.bar("holdToExitBar", this.fillMaterial);
        // Just nearer the player than the track.
        this.fill.position.z = -BAR_DEPTH;
        this.node.setEnabled(false);
        this.observer = this.scene.onBeforeRenderObservable.add(() => this.tick());
    }
    barMaterial(name, color) {
        const material = new StandardMaterial(name, this.scene);
        material.disableLighting = true;
        material.emissiveColor = color;
        return material;
    }
    bar(name, material) {
        const bar = MeshBuilder.CreateBox(name, { width: BAR_WIDTH, height: BAR_HEIGHT, depth: BAR_DEPTH }, this.scene);
        bar.material = material;
        bar.parent = this.node;
        bar.isPickable = false;
        bar.renderingGroupId = 1;
        return bar;
    }
    tick() {
        const left = this.options.xrEnvironment.controllers?.left;
        const state = this.timer.update(left?.isPrimaryButtonPressed() ?? false, performance.now());
        if (state.visible && !this.shown)
            this.placeInFrontOfHead();
        if (state.visible !== this.shown) {
            this.shown = state.visible;
            this.node.setEnabled(state.visible);
        }
        if (state.visible)
            this.showProgress(state.progress);
        if (state.done) {
            this.dispose();
            this.options.onExit();
        }
    }
    // Stays put while held, so it doesn't swing around with the head.
    placeInFrontOfHead() {
        const camera = this.scene.activeCamera;
        if (!camera)
            return;
        const { x, z } = camera.getForwardRay().direction;
        // Looking straight up or down has no direction across the floor.
        const flat = new Vector3(x, 0, z);
        const forward = flat.length() > 0.01 ? flat.normalize() : Vector3.Forward();
        this.node.position.copyFrom(camera.globalPosition
            .add(forward.scale(DISTANCE_FROM_HEAD))
            .add(new Vector3(0, -BELOW_EYES, 0)));
        this.node.rotation.y = Math.atan2(forward.x, forward.z);
    }
    // The bar fills from the player's left.
    showProgress(progress) {
        const amount = Math.max(progress, MIN_FILL);
        this.fill.scaling.x = amount;
        this.fill.position.x = (BAR_WIDTH * (amount - 1)) / 2;
    }
    // Safe to call more than once.
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        if (this.observer) {
            this.scene.onBeforeRenderObservable.remove(this.observer);
            this.observer = null;
        }
        this.text.dispose();
        this.fill.dispose();
        this.track.dispose();
        this.fillMaterial.dispose();
        this.trackMaterial.dispose();
        this.node.dispose();
    }
}
