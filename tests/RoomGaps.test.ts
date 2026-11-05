import { describe, expect, test } from "vitest";
import { gapPanels, isBehindWall } from "../src/xr/RoomGaps";

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
