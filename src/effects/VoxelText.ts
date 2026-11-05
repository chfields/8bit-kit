import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const POP_IN_MS = 250;
const NORMAL_GLOW = 1;
const HIGHLIGHT_GLOW = 1.6;
// A small gap between cubes makes them read as separate blocks.
const CUBE_FILL = 0.94;
const CUBE_DEPTH = 2.5;
const shade = (brightness: number) =>
  new Color4(brightness, brightness, brightness, 1);
// Box faces in Babylon's order: +Z, -Z (towards the player), +X, -X, +Y, -Y.
const FACE_SHADES = [
  shade(0.3),
  shade(1),
  shade(0.45),
  shade(0.45),
  shade(0.65),
  shade(0.3),
];
const HIGHLIGHT_SIZE = 1.08;
const BURST_MS = 450;
const BURST_SPEED = 2.5;
const BURST_GRAVITY = 6;

// Classic 5x7 pixel font. Each number is a row of a glyph, as 5 bits.
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [30, 1, 1, 14, 1, 1, 30],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
};

export function voxelTextWidth(text: string, cubeSize: number): number {
  return (text.length * (GLYPH_WIDTH + 1) - 1) * cubeSize;
}

export function voxelTextHeight(cubeSize: number): number {
  return GLYPH_HEIGHT * cubeSize;
}

// Text built from real 3D cubes, readable from a player looking along +Z.
export class VoxelText {
  private scene: Scene;
  private node: TransformNode;
  private template: Mesh;
  private cubes: InstancedMesh[] = [];
  private observer: Nullable<Observer<Scene>> = null;
  private material: StandardMaterial;
  private color: Color3;
  private highlighted = false;

  constructor(
    scene: Scene,
    text: string,
    center: Vector3,
    cubeSize: number,
    color: Color3,
    popIn: boolean = true
  ) {
    this.scene = scene;
    this.color = color;
    this.node = new TransformNode("voxelText", scene);
    this.node.position.copyFrom(center);

    this.template = MeshBuilder.CreateBox(
      "voxelCube",
      {
        width: cubeSize * CUBE_FILL,
        height: cubeSize * CUBE_FILL,
        depth: cubeSize * CUBE_DEPTH,
        faceColors: FACE_SHADES,
      },
      scene
    );
    this.template.isVisible = false;
    this.template.isPickable = false;
    this.template.renderingGroupId = 1;
    const material = new StandardMaterial("voxelTextMaterial", scene);
    material.diffuseColor = Color3.Black();
    material.emissiveColor = color.scale(NORMAL_GLOW);
    material.specularColor = Color3.Black();
    this.template.material = material;
    this.material = material;

    this.buildCubes(text, cubeSize);
    if (popIn) {
      this.popIn();
    }
  }

  private buildCubes(text: string, cubeSize: number) {
    const left = -voxelTextWidth(text, cubeSize) / 2 + cubeSize / 2;
    const top = ((GLYPH_HEIGHT - 1) * cubeSize) / 2;
    [...text.toUpperCase()].forEach((character, index) => {
      const glyph = FONT[character] ?? FONT[" "];
      glyph.forEach((rowBits, row) => {
        for (let column = 0; column < GLYPH_WIDTH; column++) {
          if (rowBits & (1 << (GLYPH_WIDTH - 1 - column))) {
            const cube = this.template.createInstance("voxelCube");
            cube.parent = this.node;
            cube.isPickable = false;
            cube.position.set(
              left + (index * (GLYPH_WIDTH + 1) + column) * cubeSize,
              top - row * cubeSize,
              0
            );
            this.cubes.push(cube);
          }
        }
      });
    });
  }

  private popIn() {
    const startTime = performance.now();
    this.node.scaling.setAll(0.01);
    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      const progress = Math.min((performance.now() - startTime) / POP_IN_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.node.scaling.setAll(Math.max(eased, 0.01));
      if (progress >= 1) {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.observer = null;
      }
    });
  }

  // Stays where it is, then moves along with the parent.
  public attachTo(parent: TransformNode) {
    this.node.setParent(parent);
  }

  public setVisible(visible: boolean) {
    this.node.setEnabled(visible);
  }

  public moveTo(center: Vector3) {
    this.node.position.copyFrom(center);
  }

  public setHighlighted(highlighted: boolean) {
    if (highlighted === this.highlighted || this.observer) {
      return;
    }
    this.highlighted = highlighted;
    this.material.emissiveColor = this.color.scale(
      highlighted ? HIGHLIGHT_GLOW : NORMAL_GLOW
    );
    this.node.scaling.setAll(highlighted ? HIGHLIGHT_SIZE : 1);
  }

  // Throws the cubes outward, shrinking them as they fall.
  public burst(onDone: () => void) {
    if (this.observer) {
      this.scene.onBeforeRenderObservable.remove(this.observer);
    }
    const velocities = this.cubes.map((cube) =>
      cube.position
        .add(
          new Vector3(
            Math.random() - 0.5,
            Math.random() - 0.3,
            -Math.random()
          ).scale(0.5)
        )
        .normalize()
        .scale(BURST_SPEED * (0.5 + Math.random() / 2))
    );
    const startTime = performance.now();
    let lastTime = startTime;
    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const seconds = (now - lastTime) / 1000;
      lastTime = now;
      const progress = Math.min((now - startTime) / BURST_MS, 1);
      this.cubes.forEach((cube, index) => {
        velocities[index].y -= BURST_GRAVITY * seconds;
        cube.position.addInPlace(velocities[index].scale(seconds));
        cube.scaling.setAll(Math.max(1 - progress, 0.01));
      });
      if (progress >= 1) {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.observer = null;
        onDone();
      }
    });
  }

  public dispose() {
    if (this.observer) {
      this.scene.onBeforeRenderObservable.remove(this.observer);
      this.observer = null;
    }
    this.cubes = [];
    this.template.dispose(false, true);
    this.node.dispose();
  }
}
