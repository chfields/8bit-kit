import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { BoxParticleEmitter } from "@babylonjs/core/Particles/EmitterTypes/boxParticleEmitter";
import { ParticleHelper } from "@babylonjs/core/Particles/particleHelper";
import { log } from "../game/Logger";
const EDGE_THICKNESS = 0.05;
export const PORTAL_REVEAL_MS = 1200;
// In front of the wall so the panels also hide anything placed right on it.
const MASK_IN_FRONT_OF_WALL = 0.01;
export class Portal {
    constructor(linePoints, scene, wallToWorld, start) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "linePoints", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "wallToWorld", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "start", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "boxes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "edges", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "maskPanels", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "particleSystems", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "glowLayer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "revealObserver", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.scene = scene;
        this.linePoints = linePoints;
        this.wallToWorld = wallToWorld;
        this.start = start;
        this.createPortal();
    }
    createPortal() {
        const material = this.createNeonMaterial();
        this.glowLayer = this.createGlowLayer();
        const matrix = this.wallToWorld;
        const wallNormal = Vector3.TransformNormal(Vector3.Up(), matrix).normalize();
        const corners = this.rectangleCorners().map((corner) => Vector3.TransformCoordinates(corner, matrix));
        const center = corners[0].add(corners[2]).scale(0.5);
        corners.forEach((start, index) => {
            const end = corners[(index + 1) % corners.length];
            const box = this.createEdge(start, end, wallNormal, material);
            this.edges.push({
                box,
                outward: start.add(end).scale(0.5).subtract(center),
                runsAlongWidth: index % 2 === 0,
                fullLength: Vector3.Distance(start, end),
            });
        });
        const width = Vector3.Distance(corners[0], corners[1]);
        const height = Vector3.Distance(corners[1], corners[2]);
        this.reveal(center, wallNormal, width, height);
    }
    // Starts at the given place on the wall and grows to the full portal, smoking
    // and glowing all the way.
    reveal(center, wallNormal, width, height) {
        const heightAxis = this.edges[0].outward.normalizeToNew();
        const widthAxis = Vector3.Cross(wallNormal, heightAxis).normalize();
        const placeMask = this.createMask(center, wallNormal, widthAxis, heightAxis, width, height);
        // Flattened onto the wall, in case the start isn't exactly on it.
        const fromCenter = this.start.center.subtract(center);
        const startCenter = center
            .add(widthAxis.scale(Vector3.Dot(fromCenter, widthAxis)))
            .add(heightAxis.scale(Vector3.Dot(fromCenter, heightAxis)));
        const applySize = (openCenter, openWidth, openHeight) => {
            this.edges.forEach((edge) => {
                const edgeLength = edge.runsAlongWidth ? openWidth : openHeight;
                const distance = edge.runsAlongWidth ? openHeight / 2 : openWidth / 2;
                edge.box.position.copyFrom(openCenter.add(edge.outward.normalizeToNew().scale(distance)));
                edge.box.scaling.x =
                    (edgeLength + EDGE_THICKNESS) / (edge.fullLength + EDGE_THICKNESS);
            });
            placeMask(openCenter, openWidth, openHeight);
        };
        applySize(startCenter, this.start.width, this.start.height);
        const startTime = performance.now();
        this.revealObserver = this.scene.onBeforeRenderObservable.add(() => {
            const elapsed = performance.now() - startTime - this.start.holdMs;
            const progress = Math.min(Math.max(elapsed, 0) / PORTAL_REVEAL_MS, 1);
            // Starts slowly, then opens quickly.
            const eased = progress * progress * (3 - 2 * progress);
            applySize(Vector3.Lerp(startCenter, center, eased), this.start.width + (width - this.start.width) * eased, this.start.height + (height - this.start.height) * eased);
            if (progress >= 1) {
                this.stopReveal();
            }
        });
    }
    // Invisible panels that write depth, like the room's occluders, covering the
    // wall outside the opening. Returns a function that moves them to fit a size.
    createMask(center, wallNormal, widthAxis, heightAxis, width, height) {
        const material = new StandardMaterial("portalMask", this.scene);
        material.disableLighting = true;
        material.forceDepthWrite = true;
        const camera = this.scene.activeCamera;
        const towardPlayer = camera &&
            Vector3.Dot(wallNormal, camera.globalPosition.subtract(center)) < 0
            ? wallNormal.negate()
            : wallNormal;
        const inFront = towardPlayer.scale(MASK_IN_FRONT_OF_WALL);
        const rotation = Quaternion.RotationQuaternionFromAxis(widthAxis, heightAxis, wallNormal);
        const createPanel = (panelWidth, panelHeight) => {
            const panel = MeshBuilder.CreateBox("portalMask", { width: panelWidth, height: panelHeight, depth: 0.001 }, this.scene);
            panel.rotationQuaternion = rotation.clone();
            panel.material = material;
            panel.visibility = 0.001;
            panel.renderingGroupId = 0;
            panel.isPickable = false;
            this.maskPanels.push(panel);
            return panel;
        };
        // Twice the wall's size, so they still cover it with the opening off-centre.
        // The side panels are extra tall so they also cover the corners.
        const left = createPanel(width * 2, height * 5);
        const right = createPanel(width * 2, height * 5);
        const top = createPanel(width * 2, height * 2);
        const bottom = createPanel(width * 2, height * 2);
        return (openCenter, openWidth, openHeight) => {
            const maskCenter = openCenter.add(inFront);
            const sideOffset = openWidth / 2 + width;
            const endOffset = openHeight / 2 + height;
            left.position.copyFrom(maskCenter.add(widthAxis.scale(-sideOffset)));
            right.position.copyFrom(maskCenter.add(widthAxis.scale(sideOffset)));
            top.position.copyFrom(maskCenter.add(heightAxis.scale(endOffset)));
            bottom.position.copyFrom(maskCenter.add(heightAxis.scale(-endOffset)));
        };
    }
    stopReveal() {
        if (this.revealObserver) {
            this.scene.onBeforeRenderObservable.remove(this.revealObserver);
            this.revealObserver = null;
        }
        this.maskPanels.forEach((panel) => panel.dispose(false, true));
        this.maskPanels = [];
    }
    // The headset's outline can be noisy or have extra points, so the border uses
    // the outline's bounding rectangle in the wall's own coordinates.
    rectangleCorners() {
        const xs = this.linePoints.map((point) => point.x);
        const zs = this.linePoints.map((point) => point.z);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minZ = Math.min(...zs);
        const maxZ = Math.max(...zs);
        return [
            new Vector3(minX, 0, minZ),
            new Vector3(maxX, 0, minZ),
            new Vector3(maxX, 0, maxZ),
            new Vector3(minX, 0, maxZ),
        ];
    }
    createEdge(start, end, wallNormal, material) {
        const length = Vector3.Distance(start, end);
        // Extra length overlaps the neighbouring edges to make solid square corners.
        const box = MeshBuilder.CreateBox("portalEdgeBox", {
            width: length + EDGE_THICKNESS,
            height: EDGE_THICKNESS,
            depth: EDGE_THICKNESS,
        }, this.scene);
        box.renderingGroupId = 0;
        box.material = material;
        box.position = start.add(end).scale(0.5);
        // Local X runs along the edge and local Z along the wall's normal, so every
        // edge lies flat against the wall at any wall angle.
        const direction = end.subtract(start).normalize();
        const inWall = Vector3.Cross(wallNormal, direction);
        box.rotationQuaternion = Quaternion.RotationQuaternionFromAxis(direction, inWall, wallNormal);
        this.glowLayer?.addIncludedOnlyMesh(box);
        this.createParticleSystem(box, length);
        this.boxes.push(box);
        return box;
    }
    createNeonMaterial() {
        const neonMaterial = new StandardMaterial("neonMaterial", this.scene);
        neonMaterial.emissiveColor = new Color3(0.35, 0.96, 0.88);
        return neonMaterial;
    }
    createGlowLayer() {
        return new GlowLayer("glow", this.scene, {
            mainTextureSamples: 4,
            mainTextureFixedSize: 256,
            blurKernelSize: 100,
        });
    }
    createParticleSystem(box, length) {
        ParticleHelper.ParseFromSnippetAsync("UY098C#488", this.scene, false)
            .then((system) => {
            if (this.disposed) {
                system.dispose();
                return;
            }
            system.emitter = box;
            // Emit along the edge itself, in the box's local X direction. The emitter
            // follows the box's scale, so the smoke grows with the portal.
            const emitter = new BoxParticleEmitter();
            emitter.minEmitBox = new Vector3(-length / 2, 0, 0);
            emitter.maxEmitBox = new Vector3(length / 2, 0, 0);
            emitter.direction1 = new Vector3(-1, -1, -1);
            emitter.direction2 = new Vector3(1, 1, 1);
            system.particleEmitterType = emitter;
            this.particleSystems.push(system);
        })
            .catch((error) => {
            // The effect is loaded from Babylon's snippet server and is only decoration.
            log.warn("Portal particles not loaded", error);
        });
    }
    dispose() {
        this.disposed = true;
        this.stopReveal();
        this.particleSystems.forEach((system) => system.dispose());
        this.particleSystems = [];
        this.glowLayer?.dispose();
        this.glowLayer = null;
        this.boxes.forEach((box) => {
            box.dispose(false, true);
        });
        this.boxes = [];
    }
}
