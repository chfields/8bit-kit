// What to do about walls further back than the portal wall, such as an alcove. Keeping them
// would show real wall through the portal, so they go. Their part of the room would then show
// the stars, so a panel in line with the portal wall covers the gap beside it. Sight lines
// through the portal itself never cross a panel. No Babylon imports.

// Scans of one flat wall can differ by this much, in metres.
const SAME_PLANE = 0.05;

export type Extent = { minX: number; maxX: number; minY: number; maxY: number };

export function isBehindWall(
  surface: { minZ: number; maxZ: number },
  wallZ: number
): boolean {
  return surface.minZ > wallZ - SAME_PLANE && surface.maxZ > wallZ + SAME_PLANE;
}

// The panels beside the portal wall, left first. Each is as tall as whatever it covers.
export function gapPanels(wall: Extent, behind: Extent[]): Extent[] {
  const panel = (minX: number, maxX: number, side: Extent[]): Extent => ({
    minX,
    maxX,
    minY: Math.min(wall.minY, ...side.map((extent) => extent.minY)),
    maxY: Math.max(wall.maxY, ...side.map((extent) => extent.maxY)),
  });
  const panels: Extent[] = [];
  const left = behind.filter((extent) => extent.minX < wall.minX - SAME_PLANE);
  if (left.length > 0) {
    const minX = Math.min(...left.map((extent) => extent.minX));
    panels.push(panel(minX, wall.minX, left));
  }
  const right = behind.filter((extent) => extent.maxX > wall.maxX + SAME_PLANE);
  if (right.length > 0) {
    const maxX = Math.max(...right.map((extent) => extent.maxX));
    panels.push(panel(wall.maxX, maxX, right));
  }
  return panels;
}

// Scans of neighbouring surfaces often stop short of each other, leaving slits that would show
// the stars. So walls reach a little past their edges. Set in centimetres with ?overlap=.
export const DEFAULT_WALL_OVERLAP = 0.08;
const MAX_OVERLAP_CM = 50;

export function wallOverlap(search: string): number {
  const text = new URLSearchParams(search).get("overlap");
  const centimetres = text === null || text === "" ? NaN : Number(text);
  if (!(centimetres >= 0 && centimetres <= MAX_OVERLAP_CM)) return DEFAULT_WALL_OVERLAP;
  return centimetres / 100;
}

// Moves a wall's corners outwards along its own x and z. Each move is skipped if it would carry
// a corner past the portal's plane, as that part would show through the portal.
export function stretchWall(
  positions: number[],
  margin: number,
  worldZAt: (x: number, y: number, z: number) => number,
  limitZ: number
): number[] {
  const stretched = [...positions];
  const middle = (axis: number) => {
    const values = positions.filter((_, i) => i % 3 === axis);
    return (Math.min(...values) + Math.max(...values)) / 2;
  };
  const centers = [middle(0), 0, middle(2)];
  for (let i = 0; i < stretched.length; i += 3) {
    for (const axis of [0, 2]) {
      const before = stretched[i + axis];
      const beforeZ = worldZAt(stretched[i], stretched[i + 1], stretched[i + 2]);
      stretched[i + axis] = before + Math.sign(before - centers[axis]) * margin;
      const afterZ = worldZAt(stretched[i], stretched[i + 1], stretched[i + 2]);
      if (afterZ > limitZ && afterZ > beforeZ) stretched[i + axis] = before;
    }
  }
  return stretched;
}
