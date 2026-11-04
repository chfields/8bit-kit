import { describe, expect, test } from "vitest";
import { DEFAULT_ROOM_LIMITS, roomWarnings } from "../src/xr/RoomCheck";

describe("roomWarnings", () => {
  test("has no warnings for a wide wall at a good distance", () => {
    expect(roomWarnings({ width: 4, distanceFromHead: 3 })).toEqual([]);
  });

  test("warns about a narrow wall", () => {
    expect(roomWarnings({ width: 1.9, distanceFromHead: 3 })).toEqual([
      "THIS WALL IS NARROW. TRY ANOTHER",
    ]);
  });

  test("warns when standing too close", () => {
    expect(roomWarnings({ width: 4, distanceFromHead: 1.4 })).toEqual([
      "STEP BACK FROM THE WALL",
    ]);
  });

  test("gives both warnings, the wall's first", () => {
    expect(roomWarnings({ width: 1, distanceFromHead: 1 })).toEqual([
      "THIS WALL IS NARROW. TRY ANOTHER",
      "STEP BACK FROM THE WALL",
    ]);
  });

  test("exactly at each limit is fine", () => {
    expect(
      roomWarnings({
        width: DEFAULT_ROOM_LIMITS.minWallWidth,
        distanceFromHead: DEFAULT_ROOM_LIMITS.minDistance,
      })
    ).toEqual([]);
  });

  test("a game can set its own limits", () => {
    const limits = { minWallWidth: 5, minDistance: 0.5 };
    expect(roomWarnings({ width: 4, distanceFromHead: 1 }, limits)).toEqual([
      "THIS WALL IS NARROW. TRY ANOTHER",
    ]);
  });
});
