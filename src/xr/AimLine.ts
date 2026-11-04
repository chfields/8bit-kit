import { Ray } from "@babylonjs/core/Culling/ray";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";

const DEFAULT_LENGTH = 2;
const DEFAULT_COLOR = new Color3(0.2, 1, 0.9);
const DEFAULT_TARGET_COLOR = new Color3(1, 0.8, 0.1);
const THICKNESS = 0.004;
const ALPHA = 0.8;
const MIN_LENGTH = 0.001;
// The line is built along +Z, whichever way the scene's axes are handed.
const BUILT_ALONG = new Vector3(0, 0, 1);

export type AimLineShape = { length: number; faded: boolean };

// How long to draw the line, and whether it fades.
export function aimLineShape(target: number | null, length: number): AimLineShape {
  if (target === null || !Number.isFinite(target)) return { length, faded: true };
  return { length: Math.max(target, MIN_LENGTH), faded: false };
}

// How solid the line is, at a fraction of the way along it.
export function aimLineAlpha(along: number, faded: boolean): number {
  return faded ? ALPHA * (1 - along) : ALPHA;
}

export type AimLineOptions = {
  scene: Scene;
  getAimRay: () => Nullable<Ray>;
  color?: Color3;
  // How far it runs with no target, in metres.
  length?: number;
};

// A thin glowing line along a controller's aim, for games and screens with no pistol. A game
// owns one per hand if it wants both.
export class AimLine {
  private scene: Scene;
  private getAimRay: () => Nullable<Ray>;
  private color: Color3;
  private length: number;
  private mesh: Mesh;
  private material: StandardMaterial;
  private observer: Nullable<Observer<Scene>> = null;
  private fadedColors: Float32Array;
  private solidColors: Float32Array;
  private shownFaded = true;
  private scale: number;
  private disposed = false;

  constructor(options: AimLineOptions) {
    this.scene = options.scene;
    this.getAimRay = options.getAimRay;
    this.color = (options.color ?? DEFAULT_COLOR).clone();
    this.length = options.length ?? DEFAULT_LENGTH;
    this.scale = this.length;

    this.material = new StandardMaterial("aimLineMaterial", this.scene);
    this.material.disableLighting = true;
    this.material.emissiveColor.copyFrom(this.color);
    this.material.backFaceCulling = false;

    this.mesh = MeshBuilder.CreateBox(
      "aimLine",
      { width: THICKNESS, height: THICKNESS, depth: 1, updatable: true },
      this.scene
    );
    // Starts at its origin, so scaling z sets the length.
    this.mesh.bakeTransformIntoVertices(Matrix.Translation(0, 0, 0.5));
    this.fadedColors = this.vertexColors(true);
    this.solidColors = this.vertexColors(false);
    this.mesh.setVerticesData(VertexBuffer.ColorKind, this.fadedColors, true);
    // Blended, so it draws after the room's depth, and it writes none itself.
    this.mesh.hasVertexAlpha = true;
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    this.mesh.checkCollisions = false;
    // The room's occluders are in group 0, so they're drawn first. The line is still hidden
    // beyond a surface, and shows everywhere in front of one.
    this.mesh.renderingGroupId = 1;
    this.mesh.rotationQuaternion = Quaternion.Identity();
    this.mesh.setEnabled(false);

    this.observer = this.scene.onBeforeRenderObservable.add(() => this.follow());
  }

  // Worked out once for each look, so changing the look allocates nothing, and no shader compiles.
  private vertexColors(faded: boolean): Float32Array {
    const positions = this.mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const colors = new Float32Array((positions.length / 3) * 4);
    for (let vertex = 0; vertex < positions.length / 3; vertex++) {
      colors.set([1, 1, 1, aimLineAlpha(positions[vertex * 3 + 2], faded)], vertex * 4);
    }
    return colors;
  }

  private follow() {
    const ray = this.getAimRay();
    if (!ray) {
      if (this.mesh.isEnabled()) this.mesh.setEnabled(false);
      return;
    }
    this.mesh.position.copyFrom(ray.origin);
    Quaternion.FromUnitVectorsToRef(BUILT_ALONG, ray.direction, this.mesh.rotationQuaternion!);
    this.mesh.scaling.z = this.scale;
    if (!this.mesh.isEnabled()) this.mesh.setEnabled(true);
  }

  // With a distance, the line stops there, solid, in the colour given. With null, it goes back
  // to running its set length and fading out.
  public setTarget(distance: number | null, color?: Color3) {
    if (this.disposed) return;
    const { length, faded } = aimLineShape(distance, this.length);
    this.scale = length;
    this.material.emissiveColor.copyFrom(faded ? this.color : (color ?? DEFAULT_TARGET_COLOR));
    if (faded !== this.shownFaded) {
      this.shownFaded = faded;
      this.mesh.updateVerticesData(
        VertexBuffer.ColorKind,
        faded ? this.fadedColors : this.solidColors
      );
    }
  }

  // Safe to call more than once.
  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.observer) {
      this.scene.onBeforeRenderObservable.remove(this.observer);
      this.observer = null;
    }
    this.mesh.dispose();
    this.material.dispose();
  }
}
