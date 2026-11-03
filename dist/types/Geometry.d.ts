export type Vec3 = {
    x: number;
    y: number;
    z: number;
};
export type RoomBox = {
    minX: number;
    maxX: number;
    floorY: number;
    ceilingY: number;
    wallZ: number;
    backZ: number;
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
