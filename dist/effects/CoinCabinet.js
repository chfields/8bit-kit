import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VoxelText, voxelTextWidth } from "./VoxelText";
import { GameAssetManager } from "../assets/GameAssetManager";
// All in metres, sized like a real arcade cabinet.
const BLOCK = 0.06;
const WIDTH = 13;
const HEIGHT = 30;
const DEPTH = 16;
const MIN_PLAYER_GAP = 0.6;
const WALL_GAP = 0.02;
const BUILD_MS = 1000;
const INSERT_COIN_MS = 1100;
const COIN_DROP_MS = 500;
const BLINK_MS = 180;
const BURST_MS = 450;
// How long the screen shows space before the portal expands and the cabinet explodes.
export const SCREEN_HOLD_MS = 900;
// The portal starts a little bigger than the screen, so its border stays hidden
// behind the frame from both eyes.
const OPENING_OVERLAP = 1.12;
const FLOATER_BEHIND_WALL = 1.2;
const FLOATER_WIDTH_OF_SCREEN = 0.6;
const FLOATER_STAY_MS = 1300;
const FLOATER_EXIT_MS = 300;
const FLOATER_SWAY = 0.45;
// The cabinet's profile, in rows from the floor.
const LOWER_TOP_ROW = 12;
const PANEL_UNDERSIDE_ROW = 13;
const PANEL_LIP_ROW = 14;
const PANEL_MIDDLE_ROW = 15;
const PANEL_BACK_ROW = 16;
const SCREEN_BOTTOM_ROW = 17;
const SCREEN_TOP_ROW = 24;
const MARQUEE_BOTTOM_ROW = 27;
const MARQUEE_TEXT_ROW = 28;
const VIEW_FIRST_COLUMN = 2;
const VIEW_LAST_COLUMN = WIDTH - 3;
const VIEW_FIRST_ROW = 18;
const VIEW_LAST_ROW = 23;
const COIN_SLOT_ROW = 9;
const CENTER_COLUMN = (WIDTH - 1) / 2;
const JOYSTICK_COLUMNS = [4, 8];
const JOYSTICK_DEPTH = 3;
const BUTTON_COLUMNS = [1, 2, 10, 11];
const SIDE_DARK = new Color3(0.2, 0.33, 0.4);
const SIDE_LIGHT = new Color3(0.32, 0.5, 0.6);
const TRIM = new Color3(0.42, 0.66, 0.8);
const TRIM_PALE = new Color3(0.72, 0.92, 1);
const DOOR_LIGHT = new Color3(0.5, 0.78, 0.98);
const DOOR_MID = new Color3(0.42, 0.66, 0.86);
const DOOR_DARK = new Color3(0.34, 0.54, 0.72);
const BEZEL = new Color3(0.01, 0.01, 0.02);
const SCREEN = new Color3(0.07, 0.07, 0.08);
const MARQUEE = new Color3(0.68, 0.9, 1);
const MARQUEE_TEXT = new Color3(0.9, 0.25, 0.08);
const PANEL = new Color3(0.9, 0.3, 0.12);
const BUTTON = new Color3(1, 0.85, 0.15);
const COIN_SLOT = new Color3(1, 0.75, 0.15);
const SLOT_OPENING = new Color3(0.02, 0.02, 0.02);
const SIDE_ART_FIRST_ROW = 2;
const SIDE_ART_FIRST_DEPTH = 5;
// How many columns of art fit on the screen.
export const CABINET_SCREEN_COLUMNS = VIEW_LAST_COLUMN - VIEW_FIRST_COLUMN + 1;
const SCREEN_ART_TOP_ROW = VIEW_LAST_ROW;
const SCREEN_ART_FIRST_COLUMN = VIEW_FIRST_COLUMN;
const shade = (brightness) => new Color4(brightness, brightness, brightness, 1);
// Box faces in Babylon's order: +Z, -Z (towards the player), +X, -X, +Y, -Y.
const FACE_SHADES = [
    shade(0.3),
    shade(1),
    shade(0.55),
    shade(0.55),
    shade(1),
    shade(0.25),
];
const isSideColumn = (column) => column === 0 || column === WIDTH - 1;
// How far back the front of the cabinet sits at each block, which shapes it: a
// recessed lower door, a jutting control panel, a sloped screen set back between
// the side panels, and a marquee hanging over it.
function frontDepth(row, column) {
    const side = isSideColumn(column);
    const inner = column === 1 || column === WIDTH - 2;
    if (row <= LOWER_TOP_ROW) {
        if (side)
            return 2;
        return inner ? 4 : 5;
    }
    if (row === PANEL_UNDERSIDE_ROW)
        return 3;
    if (row === PANEL_LIP_ROW)
        return 0;
    if (row === PANEL_MIDDLE_ROW)
        return 1;
    if (row === PANEL_BACK_ROW)
        return 4;
    if (row <= SCREEN_TOP_ROW) {
        // Slopes back, between side frames that stand well forward of it.
        const slope = 7 + Math.floor((row - SCREEN_BOTTOM_ROW) / 2);
        if (side)
            return slope - 5;
        return inner ? slope - 3 : slope;
    }
    if (row === SCREEN_TOP_ROW + 1)
        return 7;
    if (row === SCREEN_TOP_ROW + 2)
        return 4;
    // The marquee hangs out over the screen.
    return row === MARQUEE_BOTTOM_ROW ? 2 : 1;
}
function lowerFrontColor(row, column) {
    const fromSlot = Math.abs(column - CENTER_COLUMN);
    if (fromSlot <= 1 && Math.abs(row - COIN_SLOT_ROW) <= 1) {
        return fromSlot === 0 && row === COIN_SLOT_ROW ? SLOT_OPENING : COIN_SLOT;
    }
    if (column === 1 || column === WIDTH - 2)
        return DOOR_DARK;
    // Stepped bands of light across the door.
    const band = row + column / 2;
    if (band < 7)
        return DOOR_LIGHT;
    return band < 12 ? DOOR_MID : DOOR_DARK;
}
let art = null;
function viewColor(row, column) {
    const rows = art.screenRows[SCREEN_ART_TOP_ROW - row];
    const pixel = rows?.[column - SCREEN_ART_FIRST_COLUMN];
    return pixel ? art.colors[pixel] ?? SCREEN : SCREEN;
}
function frontColor(row, column) {
    if (row >= MARQUEE_BOTTOM_ROW)
        return MARQUEE;
    if (row > SCREEN_TOP_ROW)
        return TRIM;
    if (row >= SCREEN_BOTTOM_ROW) {
        if (isSideColumn(column))
            return TRIM_PALE;
        const inView = row >= VIEW_FIRST_ROW &&
            row <= VIEW_LAST_ROW &&
            column >= VIEW_FIRST_COLUMN &&
            column <= VIEW_LAST_COLUMN;
        return inView ? viewColor(row, column) : BEZEL;
    }
    if (row >= PANEL_LIP_ROW)
        return TRIM_PALE;
    if (row === PANEL_UNDERSIDE_ROW)
        return TRIM;
    return isSideColumn(column) ? TRIM : lowerFrontColor(row, column);
}
// The stepped top of the control panel, seen from above.
function panelTopColor(row, column, depth) {
    if (isSideColumn(column))
        return TRIM_PALE;
    const isButtonRow = (row === PANEL_MIDDLE_ROW && depth === 2) ||
        (row === PANEL_BACK_ROW && depth === 4);
    return isButtonRow && BUTTON_COLUMNS.includes(column) ? BUTTON : PANEL;
}
function sideColor(row, depth) {
    const rows = art.sideRows[art.sideRows.length - 1 - (row - SIDE_ART_FIRST_ROW)];
    const pixel = rows?.[depth - SIDE_ART_FIRST_DEPTH];
    if (pixel && pixel !== ".")
        return art.colors[pixel];
    return row <= LOWER_TOP_ROW ? SIDE_LIGHT : SIDE_DARK;
}
const playSound = (name) => GameAssetManager.existingInstance().playSound(name);
const stopSound = (name) => GameAssetManager.existingInstance().stopSound(name);
export const CABINET_DEPTH = DEPTH * BLOCK;
// An arcade cabinet that builds itself against the wall and takes a coin. Its
// screen then becomes the portal, which grows outward as the cabinet bursts apart.
export class CoinCabinet {
    // Each game calls this once at startup, before anything creates a cabinet.
    static configure(cabinetArt) {
        art = cabinetArt;
    }
    static create(scene, options) {
        return new CoinCabinet(scene, options);
    }
    // A finished cabinet to show off on the start screen, with no opening sequence.
    static createShowcase(scene, parent, localPosition) {
        const cabinet = new CoinCabinet(scene, null);
        parent.computeWorldMatrix(true);
        cabinet.node.parent = parent;
        cabinet.node.position.copyFrom(localPosition);
        cabinet.buildCubes();
        cabinet.cubes.forEach((cube) => cube.setEnabled(true));
        cabinet.createMarquee();
        cabinet.marquee?.attachTo(cabinet.node);
        return cabinet;
    }
    constructor(scene, options) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "node", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "templates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "blockName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "cabinetBlock"
        });
        Object.defineProperty(this, "cubes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "marquee", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "insertCoin", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "coin", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "floater", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "floaterTemplates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "observer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        if (!art) {
            throw new Error("CoinCabinet.configure must be called first");
        }
        this.scene = scene;
        if (!options) {
            this.options = null;
            this.blockName = "showcaseBlock";
            this.node = new TransformNode("showcaseCabinet", scene);
            return;
        }
        this.options = options;
        const { head, wallX, wallZ, floorY } = options;
        // Against the wall, unless the player is so close it would be in their face.
        const frontZ = Math.max(wallZ - DEPTH * BLOCK - WALL_GAP, head.z + MIN_PLAYER_GAP);
        this.node = new TransformNode("coinCabinet", scene);
        this.node.position.set(wallX, floorY, frontZ);
        this.buildCubes();
        this.startBuild();
    }
    templateFor(color) {
        const key = color.toHexString();
        let template = this.templates.get(key);
        if (!template) {
            template = MeshBuilder.CreateBox(this.blockName, { size: BLOCK * 0.98, faceColors: FACE_SHADES }, this.scene);
            template.isVisible = false;
            template.isPickable = false;
            template.renderingGroupId = 1;
            const material = new StandardMaterial("cabinetMaterial", this.scene);
            // Mostly lit by the scene, so tops are bright and undersides fall into shadow.
            material.diffuseColor = color.scale(0.8);
            material.specularColor = Color3.Black();
            material.emissiveColor = color.scale(0.3);
            template.material = material;
            this.templates.set(key, template);
        }
        return template;
    }
    // Only the outer shell is built, because the inside can't be seen.
    buildCubes() {
        const back = DEPTH - 1;
        for (let row = 0; row < HEIGHT; row++) {
            for (let column = 0; column < WIDTH; column++) {
                const front = frontDepth(row, column);
                const above = row < HEIGHT - 1 ? frontDepth(row + 1, column) : DEPTH;
                const below = row > 0 ? frontDepth(row - 1, column) : DEPTH;
                const left = column > 0 ? frontDepth(row, column - 1) : DEPTH;
                const right = column < WIDTH - 1 ? frontDepth(row, column + 1) : DEPTH;
                for (let depth = front; depth <= back; depth++) {
                    const isFront = depth === front;
                    const isExposed = isFront ||
                        depth === back ||
                        depth < above ||
                        depth < below ||
                        depth < left ||
                        depth < right;
                    if (!isExposed)
                        continue;
                    let color = SIDE_DARK;
                    const isPanelTop = depth < above &&
                        row >= PANEL_MIDDLE_ROW &&
                        row <= PANEL_BACK_ROW;
                    if (isPanelTop) {
                        color = panelTopColor(row, column, depth);
                    }
                    else if (isFront) {
                        color = frontColor(row, column);
                    }
                    else if (isSideColumn(column)) {
                        color = sideColor(row, depth);
                    }
                    this.addCube(color, column, row, depth);
                }
            }
        }
        this.addJoysticks();
    }
    addJoysticks() {
        JOYSTICK_COLUMNS.forEach((column) => {
            this.addCube(TRIM, column, PANEL_BACK_ROW, JOYSTICK_DEPTH);
            this.addCube(TRIM_PALE, column, PANEL_BACK_ROW + 1, JOYSTICK_DEPTH);
        });
    }
    addCube(color, column, row, depth) {
        const cube = this.templateFor(color).createInstance(this.blockName);
        cube.parent = this.node;
        cube.isPickable = false;
        cube.position.set((column - CENTER_COLUMN) * BLOCK, (row + 0.5) * BLOCK, (depth + 0.5) * BLOCK);
        cube.setEnabled(false);
        this.cubes.push(cube);
    }
    localToWorld(x, y, z) {
        return Vector3.TransformCoordinates(new Vector3(x, y, z), this.node.computeWorldMatrix(true));
    }
    // Bottom to top, block by block.
    startBuild() {
        playSound("cabinet-build");
        const startTime = performance.now();
        let shown = 0;
        this.observer = this.scene.onBeforeRenderObservable.add(() => {
            const progress = (performance.now() - startTime) / BUILD_MS;
            const target = Math.min(Math.ceil(progress * this.cubes.length), this.cubes.length);
            while (shown < target) {
                this.cubes[shown++].setEnabled(true);
            }
            if (progress >= 1) {
                this.stopAnimation();
                this.showSigns();
                this.startInsertCoin();
            }
        });
    }
    createMarquee() {
        const marqueeCube = 0.024;
        this.marquee = new VoxelText(this.scene, "8 BIT", this.localToWorld(0, (MARQUEE_TEXT_ROW + 0.5) * BLOCK, frontDepth(MARQUEE_TEXT_ROW, 1) * BLOCK - 0.02), marqueeCube, MARQUEE_TEXT);
    }
    showSigns() {
        this.createMarquee();
        const signCube = Math.min(0.02, 1.2 / voxelTextWidth("INSERT COIN", 1));
        this.insertCoin = new VoxelText(this.scene, "INSERT COIN", this.localToWorld(0, HEIGHT * BLOCK + 0.14, 2 * BLOCK), signCube, new Color3(1, 0.25, 0.25));
    }
    // The sign flashes, then a coin drops into the slot by itself.
    startInsertCoin() {
        const coinMaterial = new StandardMaterial("cabinetCoin", this.scene);
        coinMaterial.diffuseColor = Color3.Black();
        coinMaterial.specularColor = Color3.Black();
        coinMaterial.emissiveColor = new Color3(1, 0.85, 0.2);
        const coin = MeshBuilder.CreateCylinder("cabinetCoin", { diameter: BLOCK, height: 0.012, tessellation: 12 }, this.scene);
        coin.material = coinMaterial;
        coin.renderingGroupId = 1;
        coin.isPickable = false;
        coin.rotation.x = Math.PI / 2;
        coin.setEnabled(false);
        this.coin = coin;
        const slot = this.localToWorld(0, (COIN_SLOT_ROW + 0.5) * BLOCK, frontDepth(COIN_SLOT_ROW, 1) * BLOCK - 0.01);
        const dropFrom = slot.add(new Vector3(0, 0.3, -0.25));
        const dropStart = INSERT_COIN_MS - COIN_DROP_MS;
        const startTime = performance.now();
        let coinSoundPlayed = false;
        this.observer = this.scene.onBeforeRenderObservable.add(() => {
            const elapsed = performance.now() - startTime;
            const blinkOn = Math.floor(elapsed / BLINK_MS) % 2 === 0;
            this.insertCoin?.setVisible(blinkOn);
            if (elapsed >= dropStart) {
                const progress = Math.min((elapsed - dropStart) / COIN_DROP_MS, 1);
                if (!coinSoundPlayed) {
                    coinSoundPlayed = true;
                    playSound("coin-drop");
                }
                coin.setEnabled(true);
                coin.position = Vector3.Lerp(dropFrom, slot, progress * progress);
                coin.rotation.y = progress * Math.PI * 4;
            }
            if (elapsed >= INSERT_COIN_MS) {
                this.stopAnimation();
                this.disposeCoin();
                this.insertCoin?.dispose();
                this.insertCoin = null;
                this.openScreen();
            }
        });
    }
    disposeCoin() {
        this.coin?.dispose(false, true);
        this.coin = null;
    }
    // Projects the screen onto the wall along the player's line of sight, so the
    // portal lines up exactly with the screen they were looking at.
    screenOnWall() {
        const eye = this.scene.activeCamera?.globalPosition ?? this.options.head;
        const left = (VIEW_FIRST_COLUMN - CENTER_COLUMN - 0.5) * BLOCK;
        const right = (VIEW_LAST_COLUMN - CENTER_COLUMN + 0.5) * BLOCK;
        const toWall = (x, row) => {
            // The screen slopes back, so its top is deeper in than its bottom.
            const corner = this.localToWorld(x, row * BLOCK, frontDepth(row, VIEW_FIRST_COLUMN) * BLOCK);
            const reach = (this.options.wallZ - eye.z) / (corner.z - eye.z);
            return eye.add(corner.subtract(eye).scale(reach));
        };
        const lowerLeft = toWall(left, VIEW_FIRST_ROW);
        const upperRight = toWall(right, VIEW_LAST_ROW + 1);
        return {
            center: lowerLeft.add(upperRight).scale(0.5),
            width: upperRight.x - lowerLeft.x,
            height: upperRight.y - lowerLeft.y,
            holdMs: 0,
        };
    }
    // The screen becomes a window onto space, with a creature floating in the middle.
    openScreen() {
        playSound("screen-open");
        playSound("screen-hum");
        const view = this.screenOnWall();
        this.hideBlocksInFrontOf(view);
        this.showFloater(view);
        this.options.onScreenOpens({
            center: view.center,
            width: view.width * OPENING_OVERLAP,
            height: view.height * OPENING_OVERLAP,
            holdMs: SCREEN_HOLD_MS,
        });
        const startTime = performance.now();
        this.observer = this.scene.onBeforeRenderObservable.add(() => {
            const elapsed = performance.now() - startTime;
            this.swayFloater(elapsed);
            if (elapsed >= SCREEN_HOLD_MS) {
                this.stopAnimation();
                this.burst();
            }
        });
    }
    // Removes the screen, and any of the cabinet's blocks behind it that would block
    // the player's view of the wall through it.
    hideBlocksInFrontOf(view) {
        const eye = this.scene.activeCamera?.globalPosition ?? this.options.head;
        const screenZ = frontDepth(VIEW_FIRST_ROW, VIEW_FIRST_COLUMN) * BLOCK;
        const halfWidth = view.width / 2;
        const halfHeight = view.height / 2;
        this.cubes.forEach((cube) => {
            if (cube.position.z < screenZ)
                return;
            const world = this.node.position.add(cube.position);
            const reach = (this.options.wallZ - eye.z) / (world.z - eye.z);
            const onWall = eye.add(world.subtract(eye).scale(reach));
            if (Math.abs(onWall.x - view.center.x) < halfWidth &&
                Math.abs(onWall.y - view.center.y) < halfHeight) {
                cube.setEnabled(false);
            }
        });
    }
    showFloater(view) {
        const eye = this.scene.activeCamera?.globalPosition ?? this.options.head;
        const reach = (this.options.wallZ + FLOATER_BEHIND_WALL - eye.z) /
            (this.options.wallZ - eye.z);
        const center = eye.add(view.center.subtract(eye).scale(reach));
        const { grid: rows, colors } = art.floating;
        const columns = rows[0].length;
        const size = (view.width * reach * FLOATER_WIDTH_OF_SCREEN) / columns;
        const node = new TransformNode("coinFloater", this.scene);
        node.position.copyFrom(center);
        const templates = new Map();
        const templateFor = (pixel) => {
            const existing = templates.get(pixel);
            if (existing)
                return existing;
            const template = MeshBuilder.CreateBox("coinFloaterBlock", { size: size * 0.96, depth: size * 2, faceColors: FACE_SHADES }, this.scene);
            template.isVisible = false;
            template.isPickable = false;
            template.renderingGroupId = 1;
            const material = new StandardMaterial("cabinetFloater", this.scene);
            material.diffuseColor = colors[pixel].scale(0.6);
            material.emissiveColor = colors[pixel].scale(0.6);
            material.specularColor = Color3.Black();
            template.material = material;
            templates.set(pixel, template);
            return template;
        };
        rows.forEach((art, row) => {
            [...art].forEach((pixel, column) => {
                if (pixel === ".")
                    return;
                const block = templateFor(pixel).createInstance("coinFloaterBlock");
                block.parent = node;
                block.isPickable = false;
                block.position.set((column - (columns - 1) / 2) * size, ((rows.length - 1) / 2 - row) * size, 0);
            });
        });
        this.floater = node;
        this.floaterTemplates = [...templates.values()];
    }
    swayFloater(elapsed) {
        if (this.floater) {
            this.floater.rotation.y = Math.sin(elapsed * 0.003) * FLOATER_SWAY;
        }
    }
    // The cabinet explodes as the portal expands, and the creature stays a moment longer.
    burst() {
        playSound("mothership-explosion");
        playSound("portal-rush");
        this.marquee?.dispose();
        this.marquee = null;
        const velocities = this.cubes.map((cube) => cube.position
            .subtract(new Vector3(0, (HEIGHT * BLOCK) / 2, (DEPTH * BLOCK) / 2))
            .add(new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).scale(0.4))
            .normalize()
            .scale(2 + Math.random() * 2));
        const startTime = performance.now();
        let lastTime = startTime;
        let exploding = true;
        this.observer = this.scene.onBeforeRenderObservable.add(() => {
            const now = performance.now();
            const seconds = (now - lastTime) / 1000;
            lastTime = now;
            const elapsed = now - startTime;
            this.swayFloater(elapsed + SCREEN_HOLD_MS);
            if (exploding) {
                const progress = Math.min(elapsed / BURST_MS, 1);
                this.cubes.forEach((cube, index) => {
                    velocities[index].y -= 6 * seconds;
                    cube.position.addInPlace(velocities[index].scale(seconds));
                    cube.scaling.setAll(Math.max(1 - progress, 0.01));
                });
                if (progress >= 1) {
                    exploding = false;
                    this.disposeBlocks();
                }
            }
            const exitStart = FLOATER_STAY_MS - FLOATER_EXIT_MS;
            if (elapsed > exitStart) {
                const exit = Math.min((elapsed - exitStart) / FLOATER_EXIT_MS, 1);
                this.floater?.scaling.setAll(Math.max(1 - exit, 0.01));
            }
            if (elapsed >= FLOATER_STAY_MS) {
                this.dispose();
            }
        });
    }
    disposeBlocks() {
        this.templates.forEach((template) => template.dispose(false, true));
        this.templates.clear();
        this.cubes = [];
    }
    stopAnimation() {
        if (this.observer) {
            this.scene.onBeforeRenderObservable.remove(this.observer);
            this.observer = null;
        }
    }
    dispose() {
        this.stopAnimation();
        ["cabinet-build", "coin-drop", "screen-open", "screen-hum", "portal-rush"].forEach(stopSound);
        this.marquee?.dispose();
        this.marquee = null;
        this.insertCoin?.dispose();
        this.insertCoin = null;
        this.disposeCoin();
        this.floaterTemplates.forEach((template) => template.dispose(false, true));
        this.floaterTemplates = [];
        this.floater?.dispose();
        this.floater = null;
        this.disposeBlocks();
        this.node.dispose();
    }
}
