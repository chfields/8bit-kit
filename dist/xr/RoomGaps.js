// What to do about walls further back than the portal wall, such as an alcove. Keeping them
// would show real wall through the portal, so they go. Their part of the room would then show
// the stars, so a panel in line with the portal wall covers the gap beside it. Sight lines
// through the portal itself never cross a panel. No Babylon imports.
// Scans of one flat wall can differ by this much, in metres.
const SAME_PLANE = 0.05;
export function isBehindWall(surface, wallZ) {
    return surface.minZ > wallZ - SAME_PLANE && surface.maxZ > wallZ + SAME_PLANE;
}
// Whether a surface goes once this wall is the portal. Anything behind the wall goes, and so does
// another room's surface that reaches past it, such as a neighbour's floor starting under an
// alcove: seen through the portal, it would hide the stars. The player's own floor and ceiling
// stay, however far their scans run past the wall.
export function goesWithPortal(surface, wallZ, inPlayerRoom) {
    return (isBehindWall(surface, wallZ) || (!inPlayerRoom && surface.maxZ > wallZ + SAME_PLANE));
}
// The panels beside the portal wall, left first. Each is as tall as whatever it covers.
export function gapPanels(wall, behind) {
    const panel = (minX, maxX, side) => ({
        minX,
        maxX,
        minY: Math.min(wall.minY, ...side.map((extent) => extent.minY)),
        maxY: Math.max(wall.maxY, ...side.map((extent) => extent.maxY)),
    });
    const panels = [];
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
export function wallOverlap(search) {
    const text = new URLSearchParams(search).get("overlap");
    const centimetres = text === null || text === "" ? NaN : Number(text);
    if (!(centimetres >= 0 && centimetres <= MAX_OVERLAP_CM))
        return DEFAULT_WALL_OVERLAP;
    return centimetres / 100;
}
// Moves a wall's corners outwards along its own x and z. Each move is skipped if it would carry
// a corner past the portal's plane, as that part would show through the portal.
export function stretchWall(positions, margin, worldZAt, limitZ) {
    const stretched = [...positions];
    const middle = (axis) => {
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
            if (afterZ > limitZ && afterZ > beforeZ)
                stretched[i + axis] = before;
        }
    }
    return stretched;
}
// How far apart two walls' ends can be and still meet.
const WALLS_MEET = 0.2;
function distanceToSegment(point, [a, b]) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared
        ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared))
        : 0;
    return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
}
// Walls seen from above, as lines. In a fully scanned room each end meets another wall, so an
// end that meets none is where a wall is missing. The headset's floors are only rectangles
// around the room, so they can't show where its walls should be.
export function openWallEnds(walls) {
    let open = 0;
    walls.forEach((line, i) => {
        line.forEach((end) => {
            const meets = walls.some((other, j) => j !== i && distanceToSegment(end, other) <= WALLS_MEET);
            if (!meets)
                open++;
        });
    });
    return open;
}
// Whether the Test Room offers PICK and shows the red gaps: only with ?gaps in the URL, as
// they're for finding gaps in the game's cover, which a player can't fix.
export function showGapsFrom(search) {
    return new URLSearchParams(search).has("gaps");
}
