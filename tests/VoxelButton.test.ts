import { Ray } from "@babylonjs/core/Culling/ray";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VoxelButton } from "../src/screen/VoxelButton";

const CENTER = new Vector3(0, 1, 2);
const onTarget = () => new Ray(new Vector3(0, 1, 0), new Vector3(0, 0, 1), 100);
const offTarget = () => new Ray(new Vector3(5, 1, 0), new Vector3(0, 0, 1), 100);

describe("VoxelButton", () => {
  let engine: NullEngine;
  let scene: Scene;
  let onShot: ReturnType<typeof vi.fn>;
  let aim: () => Nullable<Ray>;

  const makeButton = () =>
    new VoxelButton(scene, {
      label: "GO",
      type: "go",
      center: CENTER,
      cubeSize: 0.02,
      color: new Color3(1, 1, 1),
      getAimRay: () => aim(),
      onShot,
    });
  const hitArea = () => scene.getMeshByName("goButton")!;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    new FreeCamera("camera", Vector3.Zero(), scene);
    onShot = vi.fn();
    aim = onTarget;
  });

  afterEach(() => {
    // Disposing the scene disposes any hit area left, which isn't a press.
    onShot.mockClear();
    engine.dispose();
  });

  test("press fires onShot once and removes the hit area, as a bullet does", () => {
    const button = makeButton();
    expect(button.press()).toBe(true);
    expect(onShot).toHaveBeenCalledTimes(1);
    expect(scene.getMeshByName("goButton")).toBeNull();
  });

  test("pressing twice fires once", () => {
    const button = makeButton();
    button.press();
    expect(button.press()).toBe(false);
    expect(onShot).toHaveBeenCalledTimes(1);
  });

  test("a press inside onShot doesn't fire again", () => {
    const button: VoxelButton = new VoxelButton(scene, {
      label: "GO",
      type: "go",
      center: CENTER,
      cubeSize: 0.02,
      color: new Color3(1, 1, 1),
      getAimRay: () => aim(),
      onShot: () => {
        onShot();
        button.press();
      },
    });
    button.press();
    expect(onShot).toHaveBeenCalledTimes(1);
  });

  test("press then disable fires once", () => {
    const button = makeButton();
    button.press();
    button.disable();
    expect(onShot).toHaveBeenCalledTimes(1);
  });

  test("press then dispose fires once", () => {
    const button = makeButton();
    button.press();
    button.dispose();
    expect(onShot).toHaveBeenCalledTimes(1);
  });

  test("a bullet hit then a press fires once", () => {
    const button = makeButton();
    hitArea().dispose();
    expect(onShot).toHaveBeenCalledTimes(1);
    expect(button.press()).toBe(false);
    expect(onShot).toHaveBeenCalledTimes(1);
  });

  test("a disabled button can't be pressed", () => {
    const button = makeButton();
    button.disable();
    expect(button.press()).toBe(false);
    expect(onShot).not.toHaveBeenCalled();
  });

  test("a disposed button can't be pressed", () => {
    const button = makeButton();
    button.dispose();
    expect(button.press()).toBe(false);
    expect(onShot).not.toHaveBeenCalled();
  });

  test("a burst button can't be pressed", () => {
    const button = makeButton();
    button.burst(() => {});
    expect(button.press()).toBe(false);
    expect(onShot).not.toHaveBeenCalled();
  });

  test("isAimedAt follows the ray", () => {
    const button = makeButton();
    scene.render();
    expect(button.isAimedAt()).toBe(true);
    aim = offTarget;
    expect(button.isAimedAt()).toBe(false);
    aim = () => null;
    expect(button.isAimedAt()).toBe(false);
  });

  test("isAimedAt is false once it can't be pressed", () => {
    const pressed = makeButton();
    scene.render();
    expect(pressed.isAimedAt()).toBe(true);
    pressed.press();
    expect(pressed.isAimedAt()).toBe(false);
  });

  test("aimedDistance is how far along the ray the hit area is, or null", () => {
    const button = makeButton();
    scene.render();
    // The front of the hit area, which is 0.1 deep.
    expect(button.aimedDistance()).toBeCloseTo(1.95);
    aim = offTarget;
    expect(button.aimedDistance()).toBeNull();
  });
});
