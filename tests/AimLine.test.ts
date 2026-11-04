import { Ray } from "@babylonjs/core/Culling/ray";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AimLine, aimLineAlpha, aimLineShape } from "../src/xr/AimLine";

describe("aimLineShape", () => {
  test("with no target it runs the set length and fades", () => {
    expect(aimLineShape(null, 2)).toEqual({ length: 2, faded: true });
  });

  test("with a target it stops there, solid", () => {
    expect(aimLineShape(1.25, 2)).toEqual({ length: 1.25, faded: false });
  });

  test("a target past the set length still reaches it", () => {
    expect(aimLineShape(5, 2)).toEqual({ length: 5, faded: false });
  });

  test("a target at the controller never makes a line of no length", () => {
    expect(aimLineShape(0, 2).length).toBeGreaterThan(0);
    expect(aimLineShape(-1, 2).length).toBeGreaterThan(0);
  });

  test("a distance that isn't a number counts as no target", () => {
    expect(aimLineShape(NaN, 2)).toEqual({ length: 2, faded: true });
    expect(aimLineShape(Infinity, 2)).toEqual({ length: 2, faded: true });
  });
});

describe("aimLineAlpha", () => {
  test("fades from the controller to nothing at the end", () => {
    expect(aimLineAlpha(0, true)).toBeGreaterThan(aimLineAlpha(0.5, true));
    expect(aimLineAlpha(0.5, true)).toBeGreaterThan(aimLineAlpha(1, true));
    expect(aimLineAlpha(1, true)).toBe(0);
  });

  test("is the same all along when solid", () => {
    expect(aimLineAlpha(1, false)).toBe(aimLineAlpha(0, false));
    expect(aimLineAlpha(1, false)).toBeGreaterThan(0);
  });
});

describe("AimLine", () => {
  let engine: NullEngine;
  let scene: Scene;
  let aim: Nullable<Ray>;
  let aimChecks: number;
  const line = () => scene.getMeshByName("aimLine")!;
  const material = () => scene.getMaterialByName("aimLineMaterial") as any;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    new FreeCamera("camera", new Vector3(0, 0, -5), scene);
    aimChecks = 0;
    aim = new Ray(new Vector3(1, 1, 0), new Vector3(0, 0, 1), 100);
  });

  afterEach(() => engine.dispose());

  const make = (color?: Color3, length?: number) =>
    new AimLine({ scene, getAimRay: () => (aimChecks++, aim), color, length });
  // The end of the line, in the world.
  const tip = () => {
    line().computeWorldMatrix(true);
    return Vector3.TransformCoordinates(new Vector3(0, 0, 1), line().getWorldMatrix());
  };

  test("follows the ray every frame", () => {
    make(undefined, 2);
    scene.render();
    expect(tip().equalsWithEpsilon(new Vector3(1, 1, 2), 1e-3)).toBe(true);
    aim = new Ray(new Vector3(0, 2, 0), new Vector3(1, 0, 0), 100);
    scene.render();
    expect(tip().equalsWithEpsilon(new Vector3(2, 2, 0), 1e-3)).toBe(true);
  });

  test("points the right way along a ray going backwards", () => {
    make(undefined, 2);
    aim = new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, -1), 100);
    scene.render();
    expect(tip().equalsWithEpsilon(new Vector3(0, 0, -2), 1e-3)).toBe(true);
  });

  test("hides while the ray is null, and comes back", () => {
    make();
    scene.render();
    expect(line().isEnabled()).toBe(true);
    aim = null;
    scene.render();
    expect(line().isEnabled()).toBe(false);
    aim = new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 100);
    scene.render();
    expect(line().isEnabled()).toBe(true);
  });

  test("stops at the target and changes colour, then goes back", () => {
    const start = new Color3(0, 1, 0);
    const aimLine = make(start, 2);
    aimLine.setTarget(1.5, new Color3(1, 0, 0));
    scene.render();
    expect(tip().equalsWithEpsilon(new Vector3(1, 1, 1.5), 1e-3)).toBe(true);
    expect(material().emissiveColor.equals(new Color3(1, 0, 0))).toBe(true);
    aimLine.setTarget(null);
    scene.render();
    expect(tip().equalsWithEpsilon(new Vector3(1, 1, 2), 1e-3)).toBe(true);
    expect(material().emissiveColor.equals(start)).toBe(true);
  });

  test("a target with no colour still changes colour", () => {
    const start = new Color3(0, 1, 0);
    const aimLine = make(start);
    aimLine.setTarget(1);
    expect(material().emissiveColor.equals(start)).toBe(false);
  });

  test("changing the target doesn't change the caller's colour", () => {
    const start = new Color3(0, 1, 0);
    const aimLine = make(start);
    aimLine.setTarget(1, new Color3(1, 0, 0));
    expect(start.equals(new Color3(0, 1, 0))).toBe(true);
    aimLine.setTarget(null);
    expect(start.equals(new Color3(0, 1, 0))).toBe(true);
  });

  test("swaps its fade only when it needs to, and keeps vertices along the line", () => {
    const aimLine = make();
    const alphas = () => {
      const colors = line().getVerticesData("color")!;
      return Array.from(colors).filter((_, i) => i % 4 === 3);
    };
    expect(Math.min(...alphas())).toBe(0);
    aimLine.setTarget(1);
    expect(Math.min(...alphas())).toBeGreaterThan(0);
    aimLine.setTarget(null);
    expect(Math.min(...alphas())).toBe(0);
  });

  test("can't be picked and doesn't collide", () => {
    make();
    expect(line().isPickable).toBe(false);
    expect(line().checkCollisions).toBe(false);
  });

  test("draws after the room's occluders", () => {
    make();
    expect(line().renderingGroupId).toBe(1);
  });

  test("creates nothing as frames pass or targets change", () => {
    const aimLine = make();
    scene.render();
    const meshes = scene.meshes.length;
    const materials = scene.materials.length;
    for (let i = 0; i < 20; i++) {
      aimLine.setTarget(i % 2 ? 1 : null, new Color3(1, 0, 0));
      scene.render();
    }
    expect(scene.meshes.length).toBe(meshes);
    expect(scene.materials.length).toBe(materials);
  });

  test("dispose removes its observer, mesh and material, and is safe twice", () => {
    const aimLine = make();
    scene.render();
    expect(aimChecks).toBe(1);
    aimLine.dispose();
    aimLine.dispose();
    scene.render();
    expect(aimChecks).toBe(1);
    expect(scene.getMeshByName("aimLine")).toBeNull();
    expect(scene.getMaterialByName("aimLineMaterial")).toBeNull();
  });

  test("setTarget after dispose does nothing", () => {
    const aimLine = make();
    aimLine.dispose();
    expect(() => aimLine.setTarget(1)).not.toThrow();
  });
});
