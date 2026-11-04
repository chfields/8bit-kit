import { describe, expect, test } from "vitest";
import { HoldTimer } from "../src/xr/HoldTimer";

describe("HoldTimer", () => {
  test("shows nothing until it's pressed", () => {
    expect(new HoldTimer(2000, 250).update(false, 5000)).toEqual({
      visible: false,
      progress: 0,
      done: false,
    });
  });

  test("a brief press shows nothing", () => {
    const timer = new HoldTimer(2000, 250);
    timer.update(true, 1000);
    expect(timer.update(true, 1249).visible).toBe(false);
  });

  test("shows progress once held past the delay", () => {
    const timer = new HoldTimer(2000, 250);
    timer.update(true, 1000);
    expect(timer.update(true, 2000)).toEqual({ visible: true, progress: 0.5, done: false });
  });

  test("finishes exactly at the end of the hold", () => {
    const timer = new HoldTimer(2000, 250);
    timer.update(true, 1000);
    expect(timer.update(true, 2999).done).toBe(false);
    expect(timer.update(true, 3000)).toEqual({ visible: true, progress: 1, done: true });
  });

  test("letting go starts again from nothing", () => {
    const timer = new HoldTimer(2000, 250);
    timer.update(true, 1000);
    timer.update(true, 2900);
    expect(timer.update(false, 2950).progress).toBe(0);
    timer.update(true, 3000);
    expect(timer.update(true, 3100)).toEqual({ visible: false, progress: 0.05, done: false });
  });
});
