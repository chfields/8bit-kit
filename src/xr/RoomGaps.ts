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
