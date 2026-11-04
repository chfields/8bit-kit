export type RoomLimits = {
    minWallWidth: number;
    minDistance: number;
};
export declare const DEFAULT_ROOM_LIMITS: RoomLimits;
export declare function roomWarnings(wall: {
    width: number;
    distanceFromHead: number;
}, limits?: RoomLimits): string[];
