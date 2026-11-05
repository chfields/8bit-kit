import { describe, expect, test } from "vitest";
import {
  DEFAULT_WALL_OVERLAP,
  gapPanels,
  isBehindWall,
  stretchWall,
  wallOverlap,
} from "../src/xr/RoomGaps";

const WALL_Z = 2;
const wall = { minX: -1, maxX: 1, minY: 0, maxY: 2.4 };

describe("isBehindWall", () => {
  test("a wall parallel to the portal wall and further back is behind it", () => {
    expect(isBehindWall({ minZ: 3.2, maxZ: 3.2 }, WALL_Z)).toBe(true);
  });

  test("an alcove's side wall that starts at the portal wall is behind it", () => {
    expect(isBehindWall({ minZ: 2.01, maxZ: 3.2 }, WALL_Z)).toBe(true);
    expect(isBehindWall({ minZ: 1.98, maxZ: 3.2 }, WALL_Z)).toBe(true);
  });

  test("another section of the same wall isn't behind it, however the scan rounds", () => {
    expect(isBehindWall({ minZ: 2.03, maxZ: 2.03 }, WALL_Z)).toBe(false);
    expect(isBehindWall({ minZ: 1.97, maxZ: 1.97 }, WALL_Z)).toBe(false);
  });

  test("a side wall of the room, ending at the portal wall, isn't behind it", () => {
    expect(isBehindWall({ minZ: -2, maxZ: 2 }, WALL_Z)).toBe(false);
  });

  test("a wall reaching well into the room and past the portal wall isn't behind it", () => {
    expect(isBehindWall({ minZ: -2, maxZ: 3.2 }, WALL_Z)).toBe(false);
  });
});

describe("gapPanels", () => {
  test("no walls behind means no panels", () => {
    expect(gapPanels(wall, [])).toEqual([]);
  });

  test("a wall directly behind the portal wall needs no panel, so the portal stays clear", () => {
    expect(gapPanels(wall, [{ minX: -0.5, maxX: 0.5, minY: 0, maxY: 2.4 }])).toEqual([]);
  });

  test("an alcove to the left gets one panel, from its far side to the portal wall's edge", () => {
    expect(gapPanels(wall, [{ minX: -2.5, maxX: -1, minY: 0, maxY: 2.4 }])).toEqual([
      { minX: -2.5, maxX: -1, minY: 0, maxY: 2.4 },
    ]);
  });

  test("an alcove to the right gets a panel on the right", () => {
    expect(gapPanels(wall, [{ minX: 1, maxX: 2, minY: 0, maxY: 2.4 }])).toEqual([
      { minX: 1, maxX: 2, minY: 0, maxY: 2.4 },
    ]);
  });

  test("a wall sticking out both sides gets a panel on each, and none across the portal", () => {
    expect(gapPanels(wall, [{ minX: -2, maxX: 3, minY: 0, maxY: 2.4 }])).toEqual([
      { minX: -2, maxX: -1, minY: 0, maxY: 2.4 },
      { minX: 1, maxX: 3, minY: 0, maxY: 2.4 },
    ]);
  });

  test("several walls on one side share a panel, tall enough for all of them", () => {
    expect(
      gapPanels(wall, [
        { minX: -2, maxX: -1, minY: 0.1, maxY: 2.2 },
        { minX: -2.5, maxX: -2, minY: 0, maxY: 2.6 },
      ])
    ).toEqual([{ minX: -2.5, maxX: -1, minY: 0, maxY: 2.6 }]);
  });

  test("a panel is at least as tall as the portal wall", () => {
    expect(gapPanels(wall, [{ minX: -2, maxX: -1, minY: 0.5, maxY: 1.5 }])).toEqual([
      { minX: -2, maxX: -1, minY: 0, maxY: 2.4 },
    ]);
  });
});

describe("wallOverlap", () => {
  test("reads centimetres from the URL, in metres", () => {
    expect(wallOverlap("?overlap=5")).toBeCloseTo(0.05);
    expect(wallOverlap("?stage=9&overlap=12.5")).toBeCloseTo(0.125);
  });

  test("zero turns it off", () => {
    expect(wallOverlap("?overlap=0")).toBe(0);
  });

  test("anything else uses the default", () => {
    for (const search of ["", "?overlap=", "?overlap=lots", "?overlap=-3", "?overlap=500"]) {
      expect(wallOverlap(search)).toBe(DEFAULT_WALL_OVERLAP);
    }
  });
});

describe("stretchWall", () => {
  // A flat wall in its own x and z, 1 cm thick along y. World z is its local x.
  const corners = [-1, 0, -2, 1, 0, -2, 1, 0, 2, -1, 0, 2];
  const worldZ = (x: number) => x;

  test("every corner moves outwards along both of the wall's axes", () => {
    expect(stretchWall(corners, 0.1, worldZ, 100)).toEqual([
      -1.1, 0, -2.1, 1.1, 0, -2.1, 1.1, 0, 2.1, -1.1, 0, 2.1,
    ]);
  });

  test("thickness doesn't change", () => {
    const thick = [-1, 0, -2, 1, 0.01, 2];
    const stretched = stretchWall(thick, 0.1, worldZ, 100);
    expect([stretched[1], stretched[4]]).toEqual([0, 0.01]);
  });

  test("it never crosses the portal's plane, but still stretches along the other axis", () => {
    // The wall's far end stops at the plane, so it can't show through the portal.
    expect(stretchWall(corners, 0.1, worldZ, 1)).toEqual([
      -1.1, 0, -2.1, 1, 0, -2.1, 1, 0, 2.1, -1.1, 0, 2.1,
    ]);
  });

  test("a stretch moving away from the plane is allowed even from beyond it", () => {
    expect(stretchWall(corners, 0.1, worldZ, -5)[0]).toBe(-1.1);
  });

  test("no overlap leaves the wall alone", () => {
    expect(stretchWall(corners, 0, worldZ, 100)).toEqual(corners);
  });
});
