import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Ray } from "@babylonjs/core/Culling/ray";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TestRoom } from "../src/xr/TestRoom";

// The sound isn't what's being tested, and loading the real one needs an audio engine.
vi.mock("../src/assets/GameAssetManager", () => ({
  GameAssetManager: { existingInstance: () => ({ playSound: () => {} }) },
}));

const HEAD = new Vector3(0, 1.6, 0);
// A wall 3 m ahead and 1 cm thick, so the buttons stand 0.3 m in front of its face, and 0.25 m
// below the head.
const BUTTON_Y = 1.35;
const BUTTON_Z = 2.695;
const START_X = -0.5;
const BACK_X = 0.5;
const aimedAt = (x: number) =>
  new Ray(new Vector3(x, BUTTON_Y, 0), new Vector3(0, 0, 1), 100);

describe("TestRoom's aimed buttons", () => {
  let engine: NullEngine;
  let scene: Scene;
  let aim: Nullable<Ray>;
  let wall: any;
  let room: TestRoom;
  const environment = () =>
    ({
      getFacedWall: () => wall,
      previewWall: () => {},
      previewGaps: () => {},
      endGapPreview: () => {},
      faceHead: () => {},
      getWallPlanes: () => [],
      getPathFurniturePlanes: () => [],
      getFloorY: (fallback: number) => fallback,
      lockWall: () => {},
    }) as any;

  beforeEach(() => {
    vi.spyOn(performance, "now").mockReturnValue(10_000);
    engine = new NullEngine();
    scene = new Scene(engine);
    new FreeCamera("camera", HEAD.clone(), scene);
    aim = aimedAt(START_X);
    const mesh = MeshBuilder.CreateBox("wall", { width: 4, height: 3, depth: 0.01 }, scene);
    mesh.position.z = 3;
    wall = { mesh };
    room = new TestRoom({
      xrEnvironment: environment(),
      scene,
      getAimRay: () => aim,
      onStart: () => {},
      onBack: () => {},
    });
    scene.render();
    // Now the buttons exist, a frame places their hit areas.
    scene.render();
  });

  afterEach(() => {
    room.dispose();
    engine.dispose();
    vi.restoreAllMocks();
  });

  const button = (name: string) => scene.getMeshByName(name);

  test("pressAimed presses the button the ray is on", () => {
    expect(room.pressAimed()).toBe(true);
    expect(button("testRoomStartButton")).toBeNull();
  });

  test("pressing one button stops the other responding", () => {
    room.pressAimed();
    expect(button("testRoomBackButton")).toBeNull();
  });

  test("pressAimed does nothing with the ray on no button", () => {
    aim = aimedAt(3);
    expect(room.pressAimed()).toBe(false);
    expect(button("testRoomStartButton")).not.toBeNull();
    expect(button("testRoomBackButton")).not.toBeNull();
  });

  test("pressAimed does nothing with no ray", () => {
    aim = null;
    expect(room.pressAimed()).toBe(false);
    expect(button("testRoomStartButton")).not.toBeNull();
  });

  test("pressAimed does nothing once the room is finishing", () => {
    expect(room.pressAimed()).toBe(true);
    aim = aimedAt(BACK_X);
    expect(room.pressAimed()).toBe(false);
  });

  test("pressAimed does nothing once disposed", () => {
    room.dispose();
    expect(room.pressAimed()).toBe(false);
  });

  test("a ray through both buttons presses the nearer", () => {
    aim = new Ray(new Vector3(3, BUTTON_Y, BUTTON_Z), new Vector3(-1, 0, 0), 100);
    room.pressAimed();
    expect(room.aimedDistance()).toBeNull();
    // Back is nearer from this side, so its action is what's left to run.
    expect((room as any).buttons[1].shot).toBe(true);
    expect((room as any).buttons[0].shot).toBe(false);
  });

  test("aimedDistance is the distance to the aimed button", () => {
    // The front of the hit area, which is 0.1 deep.
    expect(room.aimedDistance()).toBeCloseTo(BUTTON_Z - 0.05);
  });

  test("aimedDistance is null with the ray on no button", () => {
    aim = aimedAt(3);
    expect(room.aimedDistance()).toBeNull();
  });

  test("aimedDistance is null once the room is finishing, and once disposed", () => {
    room.pressAimed();
    aim = aimedAt(BACK_X);
    expect(room.aimedDistance()).toBeNull();
    room.dispose();
    expect(room.aimedDistance()).toBeNull();
  });
});
