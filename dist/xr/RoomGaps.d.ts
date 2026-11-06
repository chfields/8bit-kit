export type Extent = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};
export declare function isBehindWall(surface: {
    minZ: number;
    maxZ: number;
}, wallZ: number): boolean;
export declare function goesWithPortal(surface: {
    minZ: number;
    maxZ: number;
}, wallZ: number, inPlayerRoom: boolean): boolean;
export declare function gapPanels(wall: Extent, behind: Extent[]): Extent[];
export declare const DEFAULT_WALL_OVERLAP = 0.08;
export declare function wallOverlap(search: string): number;
export declare function stretchWall(positions: number[], margin: number, worldZAt: (x: number, y: number, z: number) => number, limitZ: number): number[];
export type Point2 = {
    x: number;
    z: number;
};
export declare function openWallEnds(walls: [Point2, Point2][]): number;
export declare function showGapsFrom(search: string): boolean;
