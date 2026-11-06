import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observable } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { XREnvironment } from "../src/xr/XREnvironment";

// The kit reads the page's URL for its options, as it loads and as an environment is made.
vi.hoisted(() => {
  (globalThis as any).window ??= {
    location: { search: "" },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

// A Quest that can't place a room it has scanned reports that room's surfaces at the player's
// head, and moves them with the head on every frame (seen in 8 Bit Tunnel's room dumps,
// 2026-11-06). A surface can't really be where the player's eyes are, so the kit leaves it out
// until the headset puts it somewhere real.
const HEAD = new Vector3(0, 1.68, 0);

// A wall stands upright: its polygon lies in its own x-z, turned so that is the world's x-y.
const upright = Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2);
const poseAt = (position: Vector3, rotation = upright) =>
  Matrix.Compose(Vector3.One(), rotation, position);
const square = (half: number) =>
  [
    [-half, 0, half],
    [half, 0, half],
    [half, 0, -half],
    [-half, 0, -half],
  ].map(([x, y, z]) => new Vector3(x, y, z));

let nextId = 1;
const plane = (label: string, matrix: Matrix) => ({
  id: nextId++,
  xrPlane: { semanticLabel: label },
  polygonDefinition: square(1.2),
  transformationMatrix: matrix,
});

describe("surfaces the headset reports at the player's head", () => {
  let engine: NullEngine;
  let scene: Scene;
  let camera: FreeCamera;
  let env: XREnvironment;
  let detector: {
    onPlaneAddedObservable: Observable<any>;
    onPlaneRemovedObservable: Observable<any>;
    onPlaneUpdatedObservable: Observable<any>;
  };
  const walls = () => env.getWallPlanes().map((wall: any) => wall.id);

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new NullEngine();
    scene = new Scene(engine);
    camera = new FreeCamera("camera", HEAD.clone(), scene);
    camera.setTarget(new Vector3(0, 1.68, 1));
    env = new XREnvironment(scene);
    detector = {
      onPlaneAddedObservable: new Observable(),
      onPlaneRemovedObservable: new Observable(),
      onPlaneUpdatedObservable: new Observable(),
    };
    (env as any).setupPlaneDetection({ enableFeature: () => detector });
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
    vi.useRealTimers();
  });

  test("a wall at the head is left out, and a real wall is kept", () => {
    const real = plane("wall", poseAt(new Vector3(0, 1.2, 3)));
    const atHead = plane("wall", poseAt(HEAD.clone()));
    detector.onPlaneAddedObservable.notifyObservers(real);
    detector.onPlaneAddedObservable.notifyObservers(atHead);
    expect(walls()).toEqual([real.id]);
    expect(atHead).not.toHaveProperty("mesh");
  });

  test("the faced wall is the real one, not one on the player's face", () => {
    const real = plane("wall", poseAt(new Vector3(0, 1.2, 3)));
    // Facing the player, so it lies across the line of sight, as in the dumps.
    const atHead = plane("wall", poseAt(HEAD.clone()));
    detector.onPlaneAddedObservable.notifyObservers(atHead);
    detector.onPlaneAddedObservable.notifyObservers(real);
    expect(env.getFacedWall()?.id).toBe(real.id);
  });

  test("a wall at the head is left out on the first frame, before the camera has drawn", () => {
    // Entering the headset moves the camera to the player's eyes before a frame draws, so its
    // last drawn place is still where it was outside the headset.
    camera.position.set(0, 1, -2);
    camera.computeWorldMatrix(true);
    camera.position.copyFrom(HEAD);
    const atHead = plane("wall", poseAt(HEAD.clone()));
    detector.onPlaneAddedObservable.notifyObservers(atHead);
    expect(walls()).toEqual([]);
  });

  test("a surface just in front of the head is still a surface", () => {
    const close = plane("wall", poseAt(HEAD.add(new Vector3(0, 0, 0.3))));
    detector.onPlaneAddedObservable.notifyObservers(close);
    expect(walls()).toEqual([close.id]);
  });

  test("a wall that follows the head is left out, and added once the headset places it", () => {
    const wall = plane("wall", poseAt(HEAD.clone()));
    detector.onPlaneAddedObservable.notifyObservers(wall);
    // The head moves, and the headset moves the wall with it.
    camera.position.set(0.2, 1.7, 0.1);
    wall.transformationMatrix = poseAt(camera.position.clone());
    detector.onPlaneUpdatedObservable.notifyObservers(wall);
    expect(walls()).toEqual([]);

    wall.transformationMatrix = poseAt(new Vector3(0, 1.2, 3));
    detector.onPlaneUpdatedObservable.notifyObservers(wall);
    expect(walls()).toEqual([wall.id]);
    expect(wall.mesh!.position.z).toBeCloseTo(3);
  });

  test("a placed wall that the headset moves onto the head is taken out", () => {
    const wall = plane("wall", poseAt(new Vector3(0, 1.2, 3)));
    detector.onPlaneAddedObservable.notifyObservers(wall);
    wall.transformationMatrix = poseAt(HEAD.clone());
    detector.onPlaneUpdatedObservable.notifyObservers(wall);
    expect(walls()).toEqual([]);
  });

  test("a surface removed while left out isn't added later", () => {
    const wall = plane("wall", poseAt(HEAD.clone()));
    detector.onPlaneAddedObservable.notifyObservers(wall);
    detector.onPlaneRemovedObservable.notifyObservers(wall);
    wall.transformationMatrix = poseAt(new Vector3(0, 1.2, 3));
    detector.onPlaneUpdatedObservable.notifyObservers(wall);
    expect(walls()).toEqual([]);
  });
});
