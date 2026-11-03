import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { NeonColor3 } from "../effects/Colors";
import { Vec3 } from "../types/Geometry";

const DIAMETER = 1;
const RING_THICKNESS = 0.05;
const IN_FRONT_OF_SURFACE = 0.02;
const OPEN_MS = 450;
const CLOSE_MS = 250;
const OVERSHOOT = 1.2;

type RiftParts = { ring: Mesh; disc: Mesh };
const parts = new WeakMap<Scene, RiftParts>();

// Built once and shared, because loading the stars and compiling the materials each
// time a rift opens makes the game stutter.
function partsFor(scene: Scene): RiftParts {
  const existing = parts.get(scene);
  if (existing) return existing;

  const ringMaterial = new StandardMaterial("riftRingMaterial", scene);
  ringMaterial.emissiveColor = NeonColor3;
  ringMaterial.disableLighting = true;
  const ring = MeshBuilder.CreateTorus(
    "riftRingTemplate",
    { diameter: DIAMETER, thickness: RING_THICKNESS, tessellation: 48 },
    scene
  );
  ring.material = ringMaterial;

  const discMaterial = new StandardMaterial("riftDiscMaterial", scene);
  discMaterial.disableLighting = true;
  // Black, because the stars are added to this colour. White would hide them.
  discMaterial.emissiveColor = Color3.Black();
  discMaterial.emissiveTexture = new Texture("/assets/images/stars.jpg", scene);
  const disc = MeshBuilder.CreateDisc(
    "riftDiscTemplate",
    { radius: DIAMETER / 2, tessellation: 48, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  disc.material = discMaterial;

  [ring, disc].forEach((mesh) => {
    mesh.isVisible = false;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
  });
  // Instances draw once, so this is the moment that would otherwise hitch.
  ringMaterial.forceCompilation(ring, undefined, { useInstances: true });
  discMaterial.forceCompilation(disc, undefined, { useInstances: true });

  const created = { ring, disc };
  parts.set(scene, created);
  return created;
}

// Grows past full size and settles back.
function easeOpen(t: number): number {
  const c = OVERSHOOT;
  const p = t - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
}

// Starts slowly, then snaps shut.
const easeClose = (t: number) => 1 - t * t * t;

// A round glowing rift drawn just in front of a surface. No hole is cut: the room's
// occluders hide whatever goes past the surface.
export class Rift {
  private scene: Scene;
  private root: TransformNode;
  private ring: InstancedMesh;
  private disc: InstancedMesh;
  private observer: Nullable<Observer<Scene>> = null;
  private disposed = false;

  public static prepare(scene: Scene): void {
    partsFor(scene);
  }

  constructor(scene: Scene, point: Vec3, normal: Vec3) {
    this.scene = scene;
    const facing = new Vector3(normal.x, normal.y, normal.z);
    const position = new Vector3(point.x, point.y, point.z).add(
      facing.scale(IN_FRONT_OF_SURFACE)
    );
    this.root = new TransformNode("rift", scene);
    this.root.position = position;
    this.root.lookAt(position.add(facing));

    const { ring, disc } = partsFor(scene);
    this.ring = ring.createInstance("riftRing");
    this.ring.rotation.x = Math.PI / 2;
    this.disc = disc.createInstance("riftDisc");
    [this.ring, this.disc].forEach((mesh) => {
      mesh.parent = this.root;
      mesh.isPickable = false;
    });
    this.root.scaling.setAll(0.001);
    this.animate(OPEN_MS, easeOpen, () => {});
  }

  private animate(ms: number, shape: (t: number) => number, done: () => void) {
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
    const from = this.root.scaling.x;
    const opening = shape === easeOpen;
    const start = performance.now();
    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      const t = Math.min((performance.now() - start) / ms, 1);
      const size = opening ? shape(t) : from * shape(t);
      this.root.scaling.setAll(Math.max(size, 0.001));
      if (t >= 1) {
        if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
        this.observer = null;
        done();
      }
    });
  }

  public close(): void {
    if (this.disposed) return;
    this.animate(CLOSE_MS, easeClose, () => this.dispose());
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
    this.observer = null;
    this.ring.dispose();
    this.disc.dispose();
    this.root.dispose();
  }
}
