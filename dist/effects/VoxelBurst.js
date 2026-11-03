import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
const COLUMNS = 5;
const ROWS = 3;
const LAYERS = 2;
const BURST_MS = 450;
const SPEED = 1.7;
const GRAVITY = 6;
// The colour of a model, read from whichever kind of material it has.
export function meshColor(mesh) {
    const material = mesh.material;
    return material?.albedoColor ?? material?.diffuseColor ?? Color3.White();
}
// Breaks a mesh into cubes of its own colour, thrown outward and shrinking as they
// fall, the same way the shootable buttons burst.
export class VoxelBurst {
    // A smaller fraction makes a smaller burst, for a hit that doesn't destroy it.
    constructor(scene, mesh, fraction = 1) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "template", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cubes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "velocities", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "observer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.scene = scene;
        const color = meshColor(mesh);
        mesh.computeWorldMatrix(true);
        const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox;
        const size = maximumWorld.subtract(minimumWorld).scale(fraction);
        const center = minimumWorld.add(maximumWorld).scale(0.5);
        const cubeSize = size.x / COLUMNS;
        this.template = MeshBuilder.CreateBox("burstCube", { size: cubeSize * 0.9 }, scene);
        this.template.isVisible = false;
        this.template.isPickable = false;
        this.template.renderingGroupId = 1;
        const material = new StandardMaterial("burstMaterial", scene);
        material.diffuseColor = color.scale(0.8);
        material.emissiveColor = color.scale(0.5);
        material.specularColor = Color3.Black();
        this.template.material = material;
        for (let column = 0; column < COLUMNS; column++) {
            for (let row = 0; row < ROWS; row++) {
                for (let layer = 0; layer < LAYERS; layer++) {
                    const offset = new Vector3(((column + 0.5) / COLUMNS - 0.5) * size.x, ((row + 0.5) / ROWS - 0.5) * size.y, ((layer + 0.5) / LAYERS - 0.5) * size.z);
                    const cube = this.template.createInstance("burstCube");
                    cube.isPickable = false;
                    cube.position.copyFrom(center.add(offset));
                    this.cubes.push(cube);
                    this.velocities.push(offset
                        .add(new Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).scale(cubeSize * 2))
                        .normalize()
                        .scale(SPEED * (0.5 + Math.random() / 2)));
                }
            }
        }
        this.start();
    }
    start() {
        const startTime = performance.now();
        let lastTime = startTime;
        this.observer = this.scene.onBeforeRenderObservable.add(() => {
            const now = performance.now();
            const seconds = (now - lastTime) / 1000;
            lastTime = now;
            const progress = Math.min((now - startTime) / BURST_MS, 1);
            this.cubes.forEach((cube, index) => {
                this.velocities[index].y -= GRAVITY * seconds;
                cube.position.addInPlace(this.velocities[index].scale(seconds));
                cube.scaling.setAll(Math.max(1 - progress, 0.01));
            });
            if (progress >= 1) {
                this.dispose();
            }
        });
    }
    dispose() {
        if (this.observer) {
            this.scene.onBeforeRenderObservable.remove(this.observer);
            this.observer = null;
        }
        this.cubes = [];
        this.template.dispose(false, true);
    }
}
