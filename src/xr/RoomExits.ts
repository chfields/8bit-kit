import { FurnitureBox, RoomBox, Vec3 } from "../types/Geometry";

export type RoomSurface = {
  kind: "wall" | "ceiling";
  point: Vec3;
  // Points into the room.
  normal: Vec3;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type RiftExit = {
  point: Vec3;
  // Faces into the room.
  normal: Vec3;
  // No surface to hide the enemy, so it must shrink away instead.
  midAir: boolean;
  // Where the enemy's path ends. On a surface, this is just past it.
  beyond: Vec3;
};

// Half of the rift's 1 m width.
const RIFT_RADIUS = 0.5;
const MIN_HEIGHT_ABOVE_FLOOR = 1;
const MAX_REACH = 4;
const FURNITURE_MARGIN = 0.5;
const FURNITURE_GAP = 0.2;
const PAST_SURFACE = 0.5;
const SIDE_TOLERANCE = 0.05;
// A mid-air rift stops this far before a wall that couldn't take it.
const SHORT_OF_WALL = 0.3;
const DEFAULT_ROOM_BEHIND_PLAYER = 2;
const MIN_ENTRANCE_FROM_HEAD = 1;
const ENTRANCE_TRIES = 12;

export type EntranceWall = "side" | "back";

function hitOn(
  surface: RoomSurface,
  from: Vec3,
  direction: Vec3
): { point: Vec3; distance: number } | null {
  const { normal, point } = surface;
  const facing =
    direction.x * normal.x + direction.y * normal.y + direction.z * normal.z;
  // Only surfaces that the path runs into, not ones it is moving away from.
  if (facing >= -1e-6) return null;
  const toSurface =
    (point.x - from.x) * normal.x +
    (point.y - from.y) * normal.y +
    (point.z - from.z) * normal.z;
  const distance = toSurface / facing;
  if (distance <= 0 || distance > MAX_REACH) return null;
  const hit = {
    x: from.x + direction.x * distance,
    y: from.y + direction.y * distance,
    z: from.z + direction.z * distance,
  };
  const within =
    hit.x >= surface.minX - SIDE_TOLERANCE &&
    hit.x <= surface.maxX + SIDE_TOLERANCE &&
    hit.y >= surface.minY - SIDE_TOLERANCE &&
    hit.y <= surface.maxY + SIDE_TOLERANCE &&
    hit.z >= surface.minZ - SIDE_TOLERANCE &&
    hit.z <= surface.maxZ + SIDE_TOLERANCE;
  return within ? { point: hit, distance } : null;
}

// The lowest clear height at a point, from the floor rule and nearby furniture.
function lowestClearY(point: Vec3, furniture: FurnitureBox[], floorY: number): number {
  let lowest = floorY + MIN_HEIGHT_ABOVE_FLOOR;
  furniture.forEach((item) => {
    const near =
      point.x > item.minX - FURNITURE_MARGIN &&
      point.x < item.maxX + FURNITURE_MARGIN &&
      point.z > item.minZ - FURNITURE_MARGIN &&
      point.z < item.maxZ + FURNITURE_MARGIN;
    if (near) lowest = Math.max(lowest, item.topY + FURNITURE_GAP + RIFT_RADIUS);
  });
  return lowest;
}

function clearPoint(
  surface: RoomSurface,
  hit: Vec3,
  furniture: FurnitureBox[],
  floorY: number
): Vec3 | null {
  const { normal } = surface;
  // Slides along the surface so the whole circle fits, if the surface is big enough.
  const fit = (value: number, min: number, max: number, facing: number) => {
    if (Math.abs(facing) > 0.7) return value;
    if (max - min < RIFT_RADIUS * 2) return null;
    return Math.min(Math.max(value, min + RIFT_RADIUS), max - RIFT_RADIUS);
  };
  const x = fit(hit.x, surface.minX, surface.maxX, normal.x);
  const z = fit(hit.z, surface.minZ, surface.maxZ, normal.z);
  if (x === null || z === null) return null;
  const fitted = { ...hit, x, z };
  if (surface.kind === "ceiling") return fitted;
  // Slides down from the hit as well as along the wall, if the hit is too near the top.
  const lowest = lowestClearY(fitted, furniture, floorY);
  if (lowest + RIFT_RADIUS > surface.maxY) return null;
  const y = Math.max(Math.min(hit.y, surface.maxY - RIFT_RADIUS), lowest);
  return { ...fitted, y };
}

function onSurface(point: Vec3, surface: RoomSurface): RiftExit {
  return {
    point,
    normal: surface.normal,
    midAir: false,
    beyond: {
      x: point.x - surface.normal.x * PAST_SURFACE,
      y: point.y - surface.normal.y * PAST_SURFACE,
      z: point.z - surface.normal.z * PAST_SURFACE,
    },
  };
}

// A random spot on a wall. Walls aren't always square to the room, so the coordinate
// it mostly faces along comes from the wall's plane.
function randomPointOn(surface: RoomSurface, wall: EntranceWall, random: () => number): Vec3 {
  const { normal, point } = surface;
  const between = (min: number, max: number) => min + random() * (max - min);
  const y = between(surface.minY, surface.maxY);
  if (wall === "side") {
    const z = between(surface.minZ, surface.maxZ);
    const x = point.x - (normal.y * (y - point.y) + normal.z * (z - point.z)) / normal.x;
    return { x, y, z };
  }
  const x = between(surface.minX, surface.maxX);
  const z = point.z - (normal.x * (x - point.x) + normal.y * (y - point.y)) / normal.z;
  return { x, y, z };
}

function isEntranceWall(surface: RoomSurface, wall: EntranceWall): boolean {
  if (surface.kind !== "wall") return false;
  return wall === "side" ? Math.abs(surface.normal.x) > 0.7 : surface.normal.z > 0.7;
}

function tryWall(
  wall: EntranceWall,
  surfaces: RoomSurface[],
  furniture: FurnitureBox[],
  floorY: number,
  head: Vec3,
  random: () => number
): RiftExit | null {
  const walls = surfaces.filter((surface) => isEntranceWall(surface, wall));
  if (walls.length === 0) return null;
  for (let attempt = 0; attempt < ENTRANCE_TRIES; attempt++) {
    const surface = walls[Math.floor(random() * walls.length)];
    const point = clearPoint(surface, randomPointOn(surface, wall, random), furniture, floorY);
    if (!point) continue;
    const away = Math.hypot(point.x - head.x, point.y - head.y, point.z - head.z);
    if (away < MIN_ENTRANCE_FROM_HEAD) continue;
    // A side wall is only for rifts the player can see without turning around.
    if (wall === "side" && point.z < head.z) continue;
    return onSurface(point, surface);
  }
  return null;
}

// Where a wave can come in through a real wall. Null if nowhere fits, so the wave
// should use the portal. Random numbers are passed in so tests can control them.
export function findEntranceRift(
  wall: EntranceWall,
  surfaces: RoomSurface[],
  furniture: FurnitureBox[],
  floorY: number,
  head: Vec3,
  random: () => number
): RiftExit | null {
  const found = tryWall(wall, surfaces, furniture, floorY, head, random);
  if (found || wall === "side") return found;
  return tryWall("side", surfaces, furniture, floorY, head, random);
}

export function findExit(
  from: Vec3,
  direction: Vec3,
  surfaces: RoomSurface[],
  furniture: FurnitureBox[],
  floorY: number
): RiftExit {
  const hits = surfaces
    .map((surface) => ({ surface, hit: hitOn(surface, from, direction) }))
    .filter((entry) => entry.hit !== null)
    .sort((a, b) => a.hit!.distance - b.hit!.distance);

  let reach = MAX_REACH;
  for (const { surface, hit } of hits) {
    const point = clearPoint(surface, hit!.point, furniture, floorY);
    if (point) return onSurface(point, surface);
    // The nearest rejected surface is the one that would be passed through.
    reach = Math.min(reach, Math.max(hit!.distance - SHORT_OF_WALL, 0));
  }

  const ahead = {
    x: from.x + direction.x * reach,
    y: from.y + direction.y * reach,
    z: from.z + direction.z * reach,
  };
  const ceilings = surfaces.filter((surface) => surface.kind === "ceiling");
  const lowestCeiling = ceilings.length
    ? Math.min(...ceilings.map((surface) => surface.minY))
    : Infinity;
  const point = {
    ...ahead,
    y: Math.min(
      Math.max(ahead.y, lowestClearY(ahead, furniture, floorY)),
      lowestCeiling - RIFT_RADIUS
    ),
  };
  return {
    point,
    normal: { x: -direction.x, y: -direction.y, z: -direction.z },
    midAir: true,
    beyond: { ...point },
  };
}

export function roomBoxFrom(
  wall: { minX: number; maxX: number; minY: number; maxY: number; maxZ: number },
  surfaces: RoomSurface[],
  floorY: number,
  head: Vec3
): RoomBox {
  const walls = surfaces.filter((surface) => surface.kind === "wall");
  const ceilings = surfaces.filter((surface) => surface.kind === "ceiling");
  return {
    minX: Math.min(wall.minX, ...walls.map((surface) => surface.minX)),
    maxX: Math.max(wall.maxX, ...walls.map((surface) => surface.maxX)),
    floorY,
    ceilingY: ceilings.length
      ? Math.min(...ceilings.map((surface) => surface.minY))
      : wall.maxY,
    wallZ: wall.maxZ,
    portalMinX: wall.minX,
    portalMaxX: wall.maxX,
    backZ: walls.length
      ? Math.min(...walls.map((surface) => surface.minZ))
      : head.z - DEFAULT_ROOM_BEHIND_PLAYER,
  };
}
