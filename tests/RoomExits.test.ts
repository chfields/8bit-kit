import { describe, expect, test } from "vitest";
import { findEntranceRift, findExit, roomBoxFrom, RoomSurface } from "../src/xr/RoomExits";

const backWall: RoomSurface = {
  kind: "wall",
  point: { x: 0, y: 1.25, z: -2 },
  normal: { x: 0, y: 0, z: 1 },
  minX: -2, maxX: 2, minY: 0, maxY: 2.5, minZ: -2, maxZ: -2,
};
const sideWall: RoomSurface = {
  kind: "wall",
  point: { x: 2, y: 1.25, z: 0 },
  normal: { x: -1, y: 0, z: 0 },
  minX: 2, maxX: 2, minY: 0, maxY: 2.5, minZ: -2, maxZ: 2,
};
const ceiling: RoomSurface = {
  kind: "ceiling",
  point: { x: 0, y: 2.5, z: 0 },
  normal: { x: 0, y: -1, z: 0 },
  minX: -2, maxX: 2, minY: 2.5, maxY: 2.5, minZ: -2, maxZ: 2,
};
const surfaces = [backWall, sideWall, ceiling];
const from = { x: 0, y: 1.2, z: 0 };

describe("findEntranceRift", () => {
  const leftWall: RoomSurface = {
    ...sideWall,
    point: { x: -2, y: 1.25, z: 0 },
    normal: { x: 1, y: 0, z: 0 },
    minX: -2,
    maxX: -2,
  };
  const room = [backWall, sideWall, leftWall, ceiling];
  const head = { x: 0, y: 1.6, z: 0 };
  const seeded = (seed: number) => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const many = (source: "side" | "back", surfaces = room, at = head) =>
    Array.from({ length: 50 }, (_, seed) =>
      findEntranceRift(source, surfaces, [], 0, at, seeded(seed + 1))
    );

  test("a side rift is on a side wall, with the enemy starting beyond it", () => {
    many("side").forEach((rift) => {
      expect(rift!.midAir).toBe(false);
      expect(Math.abs(rift!.normal.x)).toBe(1);
      expect(Math.abs(rift!.point.x)).toBeCloseTo(2);
      expect(Math.abs(rift!.beyond.x)).toBeCloseTo(2.5);
    });
  });

  test("both side walls get used", () => {
    expect(new Set(many("side").map((rift) => rift!.point.x)).size).toBe(2);
  });

  test("a side rift is never behind the player", () => {
    many("side", room, { x: 0, y: 1.6, z: -0.5 }).forEach((rift) => {
      expect(rift!.point.z).toBeGreaterThanOrEqual(-0.5);
    });
  });

  test("a back rift is on the wall behind the player", () => {
    many("back").forEach((rift) => {
      expect(rift!.normal).toEqual(backWall.normal);
      expect(rift!.point.z).toBeCloseTo(-2);
    });
  });

  test("a back rift falls back to a side wall if there's no back wall", () => {
    many("back", [sideWall, leftWall]).forEach((rift) => {
      expect(Math.abs(rift!.normal.x)).toBe(1);
    });
  });

  test("the whole rift fits on the wall, above the floor rule", () => {
    [...many("side"), ...many("back")].forEach((rift) => {
      expect(rift!.point.y).toBeGreaterThanOrEqual(1);
      expect(rift!.point.y).toBeLessThanOrEqual(2);
    });
  });

  test("stays at least 1 m from the player's head", () => {
    const nearWall = { x: 1.5, y: 1.6, z: 0 };
    const near = [{ ...sideWall, minZ: -0.2, maxZ: 0.8, point: { x: 2, y: 1.25, z: 0.3 } }];
    many("side", near, nearWall).forEach((rift) => expect(rift).toBeNull());
  });

  test("avoids furniture against the wall", () => {
    const shelf = { minX: 1.5, maxX: 2, minZ: -2, maxZ: 2, topY: 1.2 };
    const rift = findEntranceRift("side", [sideWall], [shelf], 0, head, seeded(5));
    expect(rift!.point.y).toBeGreaterThanOrEqual(1.2 + 0.2 + 0.5);
  });

  test("returns nothing when no wall can take a rift", () => {
    const narrow = { ...sideWall, minZ: 0, maxZ: 0.5 };
    expect(findEntranceRift("side", [narrow, ceiling], [], 0, head, seeded(3))).toBeNull();
    expect(findEntranceRift("back", [ceiling], [], 0, head, seeded(3))).toBeNull();
  });
});

describe("findExit", () => {
  test("uses the nearest surface in the direction of travel", () => {
    const exit = findExit(from, { x: 0, y: 0, z: -1 }, surfaces, [], 0);
    expect(exit.midAir).toBe(false);
    expect(exit.point.z).toBeCloseTo(-2);
    expect(exit.normal).toEqual(backWall.normal);
  });

  test("goes beyond the surface by half a metre", () => {
    const exit = findExit(from, { x: 0, y: 0, z: -1 }, surfaces, [], 0);
    expect(exit.beyond.z).toBeCloseTo(-2.5);
  });

  test("can use the ceiling", () => {
    const exit = findExit(from, { x: 0, y: 1, z: 0 }, surfaces, [], 0);
    expect(exit.midAir).toBe(false);
    expect(exit.point.y).toBeCloseTo(2.5);
  });

  test("raises a low exit to at least 1 m above the floor", () => {
    const exit = findExit({ x: 0, y: 0.4, z: 0 }, { x: 0, y: 0, z: -1 }, surfaces, [], 0);
    expect(exit.point.y).toBeGreaterThanOrEqual(1);
  });

  test("raises an exit above furniture near it", () => {
    const shelf = { minX: -1, maxX: 1, minZ: -2, maxZ: -1.5, topY: 1.2 };
    const exit = findExit(from, { x: 0, y: 0, z: -1 }, surfaces, [shelf], 0);
    expect(exit.midAir).toBe(false);
    expect(exit.point.y).toBeGreaterThan(1.4);
  });

  test("moves on from a surface with no clear space", () => {
    const tallCupboard = { minX: -1, maxX: 1, minZ: -2, maxZ: -1.5, topY: 2.4 };
    const exit = findExit(from, { x: 0.2, y: 0, z: -1 }, surfaces, [tallCupboard], 0);
    expect(exit.point.z).not.toBeCloseTo(-2);
  });

  test("ignores surfaces behind the direction of travel", () => {
    const exit = findExit(from, { x: 0, y: 0, z: 1 }, surfaces, [], 0);
    expect(exit.midAir).toBe(true);
  });

  test("opens in mid-air 4 m away when no surface is in reach", () => {
    const exit = findExit(from, { x: 0, y: 0, z: -1 }, [], [], 0);
    expect(exit.midAir).toBe(true);
    expect(exit.point.z).toBeCloseTo(-4);
    expect(exit.beyond).toEqual(exit.point);
  });

  test("a mid-air exit also stays 1 m above the floor", () => {
    const exit = findExit({ x: 0, y: 0.2, z: 0 }, { x: 0, y: 0, z: -1 }, [], [], 0);
    expect(exit.point.y).toBeGreaterThanOrEqual(1);
  });

  test("a mid-air exit rises above furniture under its point", () => {
    const table = { minX: -1, maxX: 1, minZ: -4.5, maxZ: -3.5, topY: 1.2 };
    const exit = findExit(from, { x: 0, y: 0, z: -1 }, [], [table], 0);
    expect(exit.midAir).toBe(true);
    expect(exit.point.z).toBeCloseTo(-4);
    expect(exit.point.y).toBeGreaterThan(1.4);
  });
});

describe("roomBoxFrom", () => {
  const wall = { minX: -1.5, maxX: 1.5, minY: 0, maxY: 2.4, maxZ: 2 };

  test("spans the surfaces and the portal wall", () => {
    const room = roomBoxFrom(wall, surfaces, 0, { x: 0, y: 1.6, z: 0 });
    expect(room).toEqual({
      minX: -2,
      maxX: 2,
      portalMinX: -1.5,
      portalMaxX: 1.5,
      floorY: 0,
      ceilingY: 2.5,
      wallZ: 2,
      backZ: -2,
    });
  });

  test("assumes 2 m behind the player when there is no back wall", () => {
    const room = roomBoxFrom(wall, [], 0, { x: 0, y: 1.6, z: 0.5 });
    expect(room.backZ).toBeCloseTo(-1.5);
    expect(room.ceilingY).toBe(2.4);
  });
});

describe("the 1 m rift", () => {
  const big = {
    kind: "wall" as const,
    point: { x: 0, y: 1.25, z: -2 }, normal: { x: 0, y: 0, z: 1 },
    minX: -2, maxX: 2, minY: 0, maxY: 2.5, minZ: -2, maxZ: -2,
  };
  test("slides along the wall so the whole circle fits", () => {
    const exit = findExit({ x: 1.9, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, [big], [], 0);
    expect(exit.midAir).toBe(false);
    expect(exit.point.x).toBeCloseTo(1.5);
  });
  test("slides down a wall to open a hit near its top", () => {
    const exit = findExit({ x: 0, y: 2.4, z: 0 }, { x: 0, y: 0, z: -1 }, [big], [], 0);
    expect(exit.midAir).toBe(false);
    expect(exit.point.z).toBeCloseTo(-2);
    expect(exit.point.y).toBeCloseTo(2.0);
  });
  test("skips a wall when furniture too tall to fit stands in front of it", () => {
    const tall = { minX: -1, maxX: 1, minZ: -2, maxZ: -1.5, topY: 2.1 };
    const exit = findExit({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, [big], [tall], 0);
    expect(exit.midAir).toBe(true);
  });
  test("won't open on a wall too narrow for it", () => {
    const narrow = { ...big, minX: -0.3, maxX: 0.3 };
    const exit = findExit({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, [narrow], [], 0);
    expect(exit.midAir).toBe(true);
  });
  test("a mid-air exit stops short of a wall that rejected it", () => {
    const narrow = { ...big, minX: -0.3, maxX: 0.3 };
    const exit = findExit({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, [narrow], [], 0);
    expect(exit.midAir).toBe(true);
    // The wall is 2 m away (big's plane), so it opens at most 1.7 m along.
    const wallZ = narrow.point.z;
    expect(exit.point.z).toBeGreaterThan(wallZ);
    expect(exit.point.z).toBeCloseTo(wallZ + 0.3);
  });

  test("a mid-air exit stays below the ceiling", () => {
    const small = { ...ceiling, minX: -0.5, maxX: 0.5 };
    const exit = findExit({ x: 0, y: 1.2, z: 0 }, { x: 0.707, y: 0.707, z: 0 }, [small], [], 0);
    expect(exit.midAir).toBe(true);
    expect(exit.point.y).toBeLessThanOrEqual(2.5 - 0.5 + 1e-9);
  });
});
