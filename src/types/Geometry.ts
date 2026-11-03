export type Vec3 = { x: number; y: number; z: number };

export type RoomBox = {
  minX: number;
  maxX: number;
  floorY: number;
  ceilingY: number;
  // The portal wall.
  wallZ: number;
  // The far side of the room, behind the player.
  backZ: number;
  // The portal's edges. The box can be wider, if any wall reaches past them.
  portalMinX?: number;
  portalMaxX?: number;
};

export type FurnitureBox = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
};
