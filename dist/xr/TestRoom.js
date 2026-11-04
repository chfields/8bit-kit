import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import earcut from "earcut";
import { GameAssetManager } from "../assets/GameAssetManager";
import { VoxelText, voxelTextWidth } from "../effects/VoxelText";
import { VoxelButton } from "../screen/VoxelButton";
import { roomWarnings } from "./RoomCheck";
// A game adds these to PlayerBullet.configure's destroys, so shots reach the buttons.
export const TEST_ROOM_BUTTON_TYPES = ["testRoomStart", "testRoomBack"];
// Often enough to feel live, and rarely enough that the glow doesn't flicker.
const CHECK_INTERVAL_MS = 250;
const TITLE = "THIS WALL WILL BE THE PORTAL";
const NO_WALL_TITLE = "FACE A WALL";
const TEXT_CUBE_SIZE = 0.012;
const WARNING_CUBE_SIZE = 0.009;
const BUTTON_CUBE_SIZE = 0.02;
// Text never takes more of the wall than this.
const MAX_TEXT_WIDTH_OF_WALL = 0.9;
const IN_FRONT_OF_WALL = 0.3;
// Text and buttons never sit closer than this to the player's head, even beside a near wall.
const MIN_FROM_HEAD = 0.5;
const TITLE_ABOVE_HEAD = 0.45;
const WARNING_GAP = 0.15;
const BUTTONS_BELOW_HEAD = 0.25;
const BUTTON_SPACING = 0.5;
// With no wall to stand against, how far ahead of the player the text and button go.
const NO_WALL_DISTANCE = 2;
const GLOW_ALPHA = 0.25;
const GLOW_COLOR = new Color3(0.2, 1, 0.9);
const TEXT_COLOR = new Color3(0.2, 1, 0.9);
const WARNING_COLOR = new Color3(1, 0.8, 0.1);
const START_COLOR = new Color3(0.2, 0.95, 0.3);
const BACK_COLOR = new Color3(0.95, 0.2, 0.2);
const SURFACE_COLOR = new Color3(0.6, 0.6, 0.8);
const SURFACE_ALPHA = 0.2;
// local-floor puts the floor here, for when no floor has been scanned.
const DEFAULT_FLOOR_Y = 0;
const MIN_BLOCK_HEIGHT = 0.01;
// Shows which wall the game would use, turning with the player, until they start or leave.
export class TestRoom {
    constructor(options) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "observer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastCheck", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "finishing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "wall", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "glow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "glowMaterial", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "surfaceMaterial", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "surfaces", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "texts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "warningTexts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "warningsShown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ""
        });
        Object.defineProperty(this, "buttons", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "noWallShown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // Where the title, buttons and warnings sit for the current wall, fixed when the wall is first shown.
        Object.defineProperty(this, "placement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Vector3()
        });
        this.options = options;
        this.scene = options.scene;
        this.glowMaterial = new StandardMaterial("testRoomGlow", this.scene);
        this.glowMaterial.disableLighting = true;
        this.glowMaterial.emissiveColor = GLOW_COLOR;
        this.glowMaterial.alpha = GLOW_ALPHA;
        this.glowMaterial.backFaceCulling = false;
        this.surfaceMaterial = new StandardMaterial("testRoomSurface", this.scene);
        this.surfaceMaterial.disableLighting = true;
        this.surfaceMaterial.emissiveColor = SURFACE_COLOR;
        this.surfaceMaterial.alpha = SURFACE_ALPHA;
        this.surfaceMaterial.backFaceCulling = false;
        this.observer = this.scene.onBeforeRenderObservable.add(() => this.tick());
    }
    tick() {
        const now = performance.now();
        if (this.finishing || now - this.lastCheck < CHECK_INTERVAL_MS)
            return;
        this.lastCheck = now;
        const faced = this.options.xrEnvironment.getFacedWall();
        if (faced && faced !== this.wall) {
            this.showWall(faced);
        }
        else if (this.wall) {
            this.updateWarnings();
        }
        else if (!this.noWallShown) {
            this.showNoWall();
        }
        this.updateSurfaces();
    }
    // Shows the walls other than the glowing one, and the furniture that paths would keep clear
    // of with the glowing wall as the portal.
    updateSurfaces() {
        const environment = this.options.xrEnvironment;
        const walls = environment.getWallPlanes().filter((wall) => wall !== this.wall);
        walls.forEach((plane) => this.addWall(plane));
        const furniture = environment.getPathFurniturePlanes(this.wall);
        const floorY = environment.getFloorY(DEFAULT_FLOOR_Y);
        furniture.forEach((plane) => this.addFurniture(plane, floorY));
        const shown = new Set([...walls, ...furniture]);
        this.surfaces.forEach(({ fill, outline }, plane) => {
            fill.setEnabled(shown.has(plane));
            outline.setEnabled(shown.has(plane));
        });
    }
    addWall(plane) {
        if (this.surfaces.has(plane))
            return;
        const fill = plane.mesh.clone("testRoomWall", null, true);
        fill.position.setAll(0);
        fill.rotationQuaternion = Quaternion.Identity();
        fill.scaling.setAll(1);
        const outline = MeshBuilder.CreateLines("testRoomOutline", { points: this.corners(plane, 0) }, this.scene);
        this.surfaces.set(plane, this.finishSurface(plane, fill, outline));
    }
    // A block from the surface down to the floor, which is the space paths keep out of. Only the
    // Test Room draws this: in the game, the surface stays flat.
    addFurniture(plane, floorY) {
        const existing = this.surfaces.get(plane);
        // The floor can be scanned after the furniture.
        if (existing?.floorY === floorY)
            return;
        if (existing)
            this.disposeSurface(existing);
        const bottom = this.floorInPlane(plane, floorY);
        const fill = new PolygonMeshBuilder("testRoomFurniture", plane.polygonDefinition.map((p) => new Vector2(p.x, p.z)), this.scene, earcut).build(false, Math.abs(bottom));
        // It's built downwards along the plane's y, which may point either way.
        fill.scaling.y = bottom < 0 ? 1 : -1;
        const top = this.corners(plane, 0);
        const base = this.corners(plane, bottom);
        const outline = MeshBuilder.CreateLineSystem("testRoomOutline", { lines: [top, base, ...top.map((corner, i) => [corner, base[i]])] }, this.scene);
        this.surfaces.set(plane, { ...this.finishSurface(plane, fill, outline), floorY });
    }
    // How far the floor is along the plane's own y. Never zero, so the block has a height.
    floorInPlane(plane, floorY) {
        plane.mesh.computeWorldMatrix(true);
        const { centerWorld } = plane.mesh.getBoundingInfo().boundingBox;
        const floor = new Vector3(centerWorld.x, floorY, centerWorld.z);
        const { y } = Vector3.TransformCoordinates(floor, plane.mesh.getWorldMatrix().clone().invert());
        return Math.abs(y) < MIN_BLOCK_HEIGHT ? -MIN_BLOCK_HEIGHT : y;
    }
    corners(plane, y) {
        return plane.polygonDefinition.map((p) => new Vector3(p.x, y, p.z));
    }
    finishSurface(plane, fill, outline) {
        fill.parent = plane.mesh;
        fill.material = this.surfaceMaterial;
        fill.visibility = 1;
        fill.isPickable = false;
        fill.checkCollisions = false;
        outline.color = SURFACE_COLOR;
        outline.isPickable = false;
        outline.parent = plane.mesh;
        return { fill, outline };
    }
    disposeSurface({ fill, outline }) {
        if (!fill.isDisposed())
            fill.dispose();
        if (!outline.isDisposed())
            outline.dispose();
    }
    wallBox() {
        this.wall.mesh.computeWorldMatrix(true);
        return this.wall.mesh.getBoundingInfo().boundingBox;
    }
    head() {
        return this.scene.activeCamera?.globalPosition ?? Vector3.Zero();
    }
    showWall(wall) {
        this.wall = wall;
        this.noWallShown = false;
        this.options.xrEnvironment.previewWall(wall);
        this.showGlow(wall);
        this.clearTextAndButtons();
        const { minimumWorld, maximumWorld } = this.wallBox();
        const head = this.head();
        const x = Math.min(Math.max(head.x, minimumWorld.x), maximumWorld.x);
        const z = Math.max(minimumWorld.z - IN_FRONT_OF_WALL, head.z + MIN_FROM_HEAD);
        this.placement.set(x, head.y, z);
        this.texts.push(new VoxelText(this.scene, TITLE, new Vector3(x, head.y + TITLE_ABOVE_HEAD, z), this.fittedCubeSize(TITLE, TEXT_CUBE_SIZE), TEXT_COLOR));
        const buttonY = head.y - BUTTONS_BELOW_HEAD;
        this.addButton("START", "testRoomStart", new Vector3(x - BUTTON_SPACING, buttonY, z), START_COLOR, () => this.start());
        this.addButton("BACK", "testRoomBack", new Vector3(x + BUTTON_SPACING, buttonY, z), BACK_COLOR, () => this.back());
        this.updateWarnings();
    }
    showGlow(wall) {
        this.glow?.dispose();
        const glow = wall.mesh.clone("testRoomGlow", null, true);
        glow.parent = wall.mesh;
        glow.position.setAll(0);
        glow.rotationQuaternion = Quaternion.Identity();
        glow.scaling.setAll(1);
        glow.material = this.glowMaterial;
        glow.visibility = 1;
        glow.isPickable = false;
        glow.checkCollisions = false;
        this.glow = glow;
    }
    showNoWall() {
        this.noWallShown = true;
        this.options.xrEnvironment.faceHead();
        this.clearTextAndButtons();
        const head = this.head();
        const z = head.z + NO_WALL_DISTANCE;
        this.texts.push(new VoxelText(this.scene, NO_WALL_TITLE, new Vector3(head.x, head.y + TITLE_ABOVE_HEAD, z), TEXT_CUBE_SIZE, TEXT_COLOR));
        this.addButton("BACK", "testRoomBack", new Vector3(head.x, head.y - BUTTONS_BELOW_HEAD, z), BACK_COLOR, () => this.back());
    }
    fittedCubeSize(text, cubeSize) {
        const { minimumWorld, maximumWorld } = this.wallBox();
        const room = (maximumWorld.x - minimumWorld.x) * MAX_TEXT_WIDTH_OF_WALL;
        return Math.min(cubeSize, (cubeSize * room) / voxelTextWidth(text, cubeSize));
    }
    updateWarnings() {
        const { minimumWorld, maximumWorld } = this.wallBox();
        const head = this.head();
        const warnings = roomWarnings({
            width: maximumWorld.x - minimumWorld.x,
            distanceFromHead: minimumWorld.z - head.z,
        }, this.options.limits);
        const key = warnings.join("|");
        if (key === this.warningsShown)
            return;
        this.warningsShown = key;
        this.clearWarnings();
        const { x, y, z } = this.placement;
        warnings.forEach((warning, index) => {
            this.warningTexts.push(new VoxelText(this.scene, warning, new Vector3(x, y + TITLE_ABOVE_HEAD - WARNING_GAP * (index + 1), z), this.fittedCubeSize(warning, WARNING_CUBE_SIZE), WARNING_COLOR));
        });
    }
    addButton(label, type, center, color, action) {
        const button = new VoxelButton(this.scene, {
            label,
            type,
            center,
            cubeSize: BUTTON_CUBE_SIZE,
            color,
            getAimRay: this.options.getAimRay,
            onShot: () => this.buttonShot(button, action),
        });
        this.buttons.push(button);
    }
    // The shot button bursts, then its action runs.
    buttonShot(shot, action) {
        this.finishing = true;
        GameAssetManager.existingInstance().playSound("mothership-explosion");
        this.buttons
            .filter((button) => button !== shot)
            .forEach((button) => button.disable());
        shot.burst(action);
    }
    start() {
        const wall = this.wall;
        this.dispose();
        this.options.onStart();
        this.options.xrEnvironment.lockWall(wall);
    }
    back() {
        this.dispose();
        this.options.onBack();
    }
    clearWarnings() {
        this.warningTexts.forEach((text) => text.dispose());
        this.warningTexts = [];
    }
    clearTextAndButtons() {
        this.texts.forEach((text) => text.dispose());
        this.texts = [];
        this.clearWarnings();
        this.warningsShown = "";
        this.buttons.forEach((button) => button.dispose());
        this.buttons = [];
    }
    // Safe to call more than once, and after the session has removed the room's planes.
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        if (this.observer) {
            this.scene.onBeforeRenderObservable.remove(this.observer);
            this.observer = null;
        }
        this.clearTextAndButtons();
        if (this.glow && !this.glow.isDisposed())
            this.glow.dispose();
        this.glow = null;
        this.glowMaterial.dispose();
        this.surfaces.forEach((surface) => this.disposeSurface(surface));
        this.surfaces.clear();
        this.surfaceMaterial.dispose();
    }
}
