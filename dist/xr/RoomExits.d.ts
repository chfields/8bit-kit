import { FurnitureBox, RoomBox, Vec3 } from "../types/Geometry";
export type RoomSurface = {
    kind: "wall" | "ceiling";
    point: Vec3;
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
    normal: Vec3;
    midAir: boolean;
    beyond: Vec3;
};
export type EntranceWall = "side" | "back";
export declare function findEntranceRift(wall: EntranceWall, surfaces: RoomSurface[], furniture: FurnitureBox[], floorY: number, head: Vec3, random: () => number): RiftExit | null;
export declare function findExit(from: Vec3, direction: Vec3, surfaces: RoomSurface[], furniture: FurnitureBox[], floorY: number): RiftExit;
export declare function roomBoxFrom(wall: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    maxZ: number;
}, surfaces: RoomSurface[], floorY: number, head: Vec3): RoomBox;
