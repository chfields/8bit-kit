export type RoomLimits = { minWallWidth: number; minDistance: number };

// Starting guesses, to check on a headset.
export const DEFAULT_ROOM_LIMITS: RoomLimits = {
  minWallWidth: 2,
  minDistance: 1.5,
};

// The warnings for this wall, in the order they should be shown.
export function roomWarnings(
  wall: { width: number; distanceFromHead: number },
  limits: RoomLimits = DEFAULT_ROOM_LIMITS
): string[] {
  const warnings: string[] = [];
  if (wall.width < limits.minWallWidth) {
    warnings.push("THIS WALL IS NARROW. TRY ANOTHER");
  }
  if (wall.distanceFromHead < limits.minDistance) {
    warnings.push("STEP BACK FROM THE WALL");
  }
  return warnings;
}
