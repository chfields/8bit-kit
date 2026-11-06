import { Ray } from "@babylonjs/core/Culling/ray";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Quaternion, Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { WebXRPlaneDetector } from "@babylonjs/core/XR/features/WebXRPlaneDetector";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllerComponent";
import { WebXRFeatureName } from "@babylonjs/core/XR/webXRFeaturesManager";
import { WebXRState } from "@babylonjs/core/XR/webXRTypes";
import { XRInputControllers } from "./XRInputControllers";
import earcut from "earcut";
import { gapPanels, goesWithPortal, openWallEnds, stretchWall, wallOverlap, } from "./RoomGaps";
import { OccluderPlane } from "./OccluderPlane";
import { Portal } from "./Portal";
import { ErrorScreenXR } from "../screen/ErrorScreenXR";
import { log } from "../game/Logger";
const PLANE_SCAN_TIMEOUT_MS = 5000;
const WALL_SEARCH_INTERVAL_MS = 500;
const NOT_FURNITURE = ["wall", "floor", "ceiling"];
const MAX_SURFACE_THICKNESS = 0.2;
// The portal draws over furniture whose near edge is this close to its wall. Paths only ignore
// furniture that's entirely this close, so they still avoid a deep table against the wall.
const PORTAL_FURNITURE_GAP = 0.5;
// A wall moving by less than this keeps its shape.
const OUTLINE_CHANGE = 0.02;
const COPY_OF_WALL_GAP = 0.15;
const COPY_OF_WALL_DEPTH = 0.2;
// How far a surface may reach past the edge of the floor under the player and still be part of
// their room. Less than an inner wall is thick, so the next room's side of it doesn't count.
const ROOM_EDGE = 0.1;
const UNSCANNED_MESSAGE = "This room isn't scanned";
export class XREnvironment {
    constructor(scene) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "xrHelper", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "enterExitObservers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "addSizeObservers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "controllers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "occluderMaterial", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "portal", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "foundPlane", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "webXRPlaneDetector", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "planes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "lastCheckTime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastCheck", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "spaceType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "local-floor"
        });
        Object.defineProperty(this, "skybox", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "wallSearch", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "wallSearchStart", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "roomCaptureTried", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "messageScreen", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        // Parent of the camera, controllers and room planes. Turned so the chosen wall
        // faces along +Z, which is the direction all of the game code assumes.
        Object.defineProperty(this, "wallAlignment", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "openPortalLater", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        // Walls aren't picked automatically while the player chooses one in Test Room.
        Object.defineProperty(this, "choosingWall", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // Walls behind the portal wall, and the panels covering the gap they leave.
        Object.defineProperty(this, "gapWalls", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "gapPanelMeshes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "gapPreviewKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "previewMaterial", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "overlap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: wallOverlap(window.location.search)
        });
        this.scene = scene;
        this.occluderMaterial = new StandardMaterial("om", scene);
        this.occluderMaterial.disableLighting = true; // We don't need anything but the position information
        this.occluderMaterial.forceDepthWrite = true; //Ensure depth information is written to the buffer so meshes further away will not be drawn
    }
    async hideEnterExitButton() {
        if (this.xrHelper) {
            this.xrHelper.enterExitUI.dispose();
            this.xrHelper.enterExitUI.activeButtonChangedObservable.clear();
        }
    }
    async enterExitObserver(observer) {
        this.enterExitObservers.push(observer);
    }
    async addSizeObserver(observer) {
        this.addSizeObservers.push(observer);
    }
    async initXR() {
        const xrHelper = await this.scene.createDefaultXRExperienceAsync({
            uiOptions: {
                sessionMode: "immersive-ar",
                referenceSpaceType: this.spaceType,
                onError: (error) => {
                    alert(error);
                },
            },
            inputOptions: {
                doNotLoadControllerMeshes: true,
            },
            disableTeleportation: true,
        });
        xrHelper.pointerSelection.displayLaserPointer = false;
        xrHelper.pointerSelection.displaySelectionMesh = false;
        this.xrHelper = xrHelper;
        this.setupFeatures();
        this.setupController();
        const sessionManager = xrHelper.baseExperience.sessionManager;
        sessionManager.onXRSessionEnded.add(() => {
            this.resetSession();
            this.enterExitObservers.forEach((observer) => observer(true));
        });
        sessionManager.onXRReady.add(() => {
            this.enterExitObservers.forEach((observer) => observer(false));
        });
    }
    addPlane(plane) {
        // ignore xrPlane of the following planes
        // The label is optional, so some devices report planes without one.
        const planeType = plane.xrPlane.semanticLabel ?? "";
        const excludeTypes = ["wall art", "door", "window", "shelf", "screen"];
        if (excludeTypes.some((type) => planeType.includes(type))) {
            return;
        }
        plane.mesh = this.createPolygonMesh(plane);
        plane.mesh.parent = this.wallAlignment;
        this.planes.push(plane);
    }
    planesScanning() {
        if (this.lastCheck) {
            return;
        }
        this.lastCheck = setInterval(() => {
            if (this.lastCheckTime > 0) {
                if (Date.now() - this.lastCheckTime > 400) {
                    clearInterval(this.lastCheck);
                    this.lastCheck = 0;
                    this.processPlanes(this.planes);
                    return;
                }
            }
        }, 100);
    }
    setupPlaneDetection(featureManager) {
        const webXRPlaneDetector = featureManager.enableFeature(WebXRPlaneDetector.Name, "latest");
        this.webXRPlaneDetector = webXRPlaneDetector;
        // check if plane detection has not been called in 1 second
        webXRPlaneDetector.onPlaneAddedObservable.add((plane) => {
            this.addPlane(plane);
            this.lastCheckTime = Date.now();
            this.planesScanning();
        });
        webXRPlaneDetector.onPlaneRemovedObservable.add((plane) => {
            this.forgetPlane(plane);
        });
        webXRPlaneDetector.onPlaneUpdatedObservable.add((plane) => {
            this.followPlane(plane);
        });
    }
    // The portal is built on its wall, so that wall stays for the session whatever the headset
    // does. Any copy of it the headset reports later is left see-through.
    forgetPlane(plane) {
        if (plane === this.foundPlane)
            return;
        const index = this.planes.indexOf(plane);
        if (index < 0)
            return;
        this.removePlaneMesh(plane);
        this.planes.splice(index, 1);
        this.gapPreviewKey = null;
    }
    followPlane(plane) {
        if (!plane.mesh || plane === this.foundPlane)
            return;
        if (this.sameOutline(plane)) {
            this.closePolygon(plane);
            const mesh = plane.mesh;
            plane.transformationMatrix.decompose(mesh.scaling, mesh.rotationQuaternion, mesh.position);
            mesh.computeWorldMatrix(true);
            return;
        }
        // Build it again, and let the usual pass decide what it does, as for a new surface.
        this.removePlaneMesh(plane);
        plane.scannedPositions = null;
        plane.mesh = this.createPolygonMesh(plane);
        plane.mesh.parent = this.wallAlignment;
        plane.mesh.computeWorldMatrix(true);
        plane.processed = false;
        this.gapPreviewKey = null;
        this.lastCheckTime = Date.now();
        this.planesScanning();
    }
    // Whether the polygon still matches the one the mesh was built from, closing point aside.
    sameOutline(plane) {
        const built = plane.builtOutline;
        const points = plane.polygonDefinition;
        const open = points[0] === points[points.length - 1] ? points.slice(0, -1) : points;
        if (!built || built.length !== open.length + 1)
            return false;
        return open.every((point, i) => Math.abs(point.x - built[i][0]) < OUTLINE_CHANGE &&
            Math.abs(point.z - built[i][1]) < OUTLINE_CHANGE);
    }
    closePolygon(plane) {
        const points = plane.polygonDefinition;
        if (points[0] !== points[points.length - 1])
            points.push(points[0]);
    }
    // Another report of the portal's own wall, rather than a neighbouring section of it.
    isPortalWallCopy(plane) {
        if (!this.foundPlane?.mesh || !this.isWall(plane))
            return false;
        plane.mesh.computeWorldMatrix(true);
        const wall = this.foundPlane.mesh.getBoundingInfo().boundingBox;
        const box = plane.mesh.getBoundingInfo().boundingBox;
        const samePlane = Math.abs(box.centerWorld.z - wall.centerWorld.z) < COPY_OF_WALL_GAP &&
            box.maximumWorld.z - box.minimumWorld.z < COPY_OF_WALL_DEPTH;
        const shared = Math.min(box.maximumWorld.x, wall.maximumWorld.x) -
            Math.max(box.minimumWorld.x, wall.minimumWorld.x);
        const narrower = Math.min(box.maximumWorld.x - box.minimumWorld.x, wall.maximumWorld.x - wall.minimumWorld.x);
        return samePlane && shared > narrower / 2;
    }
    createPolygonMesh(plane) {
        this.closePolygon(plane);
        plane.builtOutline = plane.polygonDefinition.map((p) => [p.x, p.z]);
        var polygon_triangulation = new PolygonMeshBuilder("xrPlaneMesh", plane.polygonDefinition.map((p) => new Vector2(p.x, p.z)), this.scene, earcut);
        var polygon = polygon_triangulation.build(false, 0.01);
        polygon.createNormals(true);
        polygon.rotationQuaternion = new Quaternion();
        plane.transformationMatrix.decompose(polygon.scaling, polygon.rotationQuaternion, polygon.position);
        polygon.ellipsoid = new Vector3(0.1, 0.1, 0.1);
        polygon.visibility = 0.001;
        return polygon;
    }
    findPlaneWithRay(plane, ray, findType = "wall") {
        if (!ray) {
            const camera = this.scene.activeCamera;
            ray = camera?.getForwardRay();
        }
        if (ray) {
            const picked = this.scene.pickWithRay(ray, (mesh) => {
                if (mesh === plane.mesh) {
                    return true;
                }
                return false;
            });
            // and plane type is wall
            const planeType = plane.xrPlane.semanticLabel;
            if (picked && picked.hit && planeType === findType) {
                return true;
            }
        }
        return false;
    }
    removePlaneMesh(plane) {
        if (plane.mesh) {
            plane.mesh.dispose(false, true);
            plane.mesh = null;
        }
    }
    // Walls behind the portal wall are removed, as they'd show through the portal, and panels
    // cover the gap they leave beside it. Everything else stays: it's a real surface.
    removeAnyPlanBehindFoundPlane(foundPlane, planes, camera) {
        const { minimumWorld: wallMin, maximumWorld: wallMax } = foundPlane.mesh.getBoundingInfo().boundingBox;
        if (camera.globalPosition.z >= wallMin.z)
            return;
        planes.forEach((plane) => {
            if (plane.id === foundPlane.id || !plane.mesh)
                return;
            const { minimumWorld, maximumWorld } = plane.mesh.getBoundingInfo()
                .boundingBox;
            // The wall's far face, as surfaces are compared by their own far faces.
            const surface = { minZ: minimumWorld.z, maxZ: maximumWorld.z };
            if (!goesWithPortal(surface, wallMax.z, this.inPlayerRoom(plane))) {
                return;
            }
            if (this.isWall(plane)) {
                this.gapWalls.push({
                    minX: minimumWorld.x,
                    maxX: maximumWorld.x,
                    minY: minimumWorld.y,
                    maxY: maximumWorld.y,
                });
            }
            this.removePlaneMesh(plane);
        });
        this.placeGapPanels(wallMin, wallMax);
    }
    // Shows which surfaces would hide what's beyond the room if this wall became the portal, by
    // the same rules as the game, while removing nothing: the player can still choose another
    // wall. The glowing wall stays solid here, as its glow covers it. Safe to call often.
    previewGaps(wall) {
        const key = `${wall.id}:${this.planes.length}`;
        if (key === this.gapPreviewKey)
            return;
        this.gapPreviewKey = key;
        this.previewMaterial ?? (this.previewMaterial = this.createPreviewMaterial());
        wall.mesh.computeWorldMatrix(true);
        const { minimumWorld: wallMin, maximumWorld: wallMax } = wall.mesh.getBoundingInfo()
            .boundingBox;
        this.gapWalls = [];
        this.planes.forEach((plane) => {
            if (!plane.mesh)
                return;
            plane.mesh.computeWorldMatrix(true);
            const { minimumWorld, maximumWorld } = plane.mesh.getBoundingInfo()
                .boundingBox;
            const behind = plane !== wall &&
                goesWithPortal({ minZ: minimumWorld.z, maxZ: maximumWorld.z }, wallMax.z, this.inPlayerRoom(plane));
            if (behind && this.isWall(plane)) {
                this.gapWalls.push({
                    minX: minimumWorld.x,
                    maxX: maximumWorld.x,
                    minY: minimumWorld.y,
                    maxY: maximumWorld.y,
                });
            }
            const hidden = behind || (plane !== wall && this.isFurnitureAtWall(plane, wall));
            plane.mesh.material = hidden ? null : this.previewMaterial;
            this.restoreWallSize(plane);
            if (!hidden && plane !== wall && this.isWall(plane)) {
                this.stretchWallPast(plane, wallMin.z);
            }
        });
        this.placeGapPanels(wallMin, wallMax);
    }
    endGapPreview() {
        this.gapPreviewKey = null;
        this.planes.forEach((plane) => {
            if (!plane.mesh)
                return;
            plane.mesh.material = null;
            this.restoreWallSize(plane);
        });
        this.previewMaterial?.dispose();
        this.previewMaterial = null;
        this.gapWalls = [];
        this.gapPanelMeshes.forEach((mesh) => mesh.dispose(false, true));
        this.gapPanelMeshes = [];
    }
    // Bounds stay as scanned, so rifts and paths still use the wall's real size.
    stretchWallPast(plane, limitZ) {
        if (this.overlap === 0)
            return;
        const mesh = plane.mesh;
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
        if (!positions)
            return;
        // Test Room's surfaces are copies that keep showing the wall's scanned size.
        mesh.makeGeometryUnique();
        plane.scannedPositions ?? (plane.scannedPositions = Array.from(positions));
        const scannedBounds = mesh.getBoundingInfo();
        mesh.computeWorldMatrix(true);
        const world = mesh.getWorldMatrix();
        const point = new Vector3();
        mesh.setVerticesData(VertexBuffer.PositionKind, stretchWall(plane.scannedPositions, this.overlap, (x, y, z) => {
            point.set(x, y, z);
            return Vector3.TransformCoordinates(point, world).z;
        }, limitZ));
        mesh.setBoundingInfo(scannedBounds);
        // Its bounds are smaller than the stretched wall, so it must never be culled by them.
        mesh.alwaysSelectAsActiveMesh = true;
    }
    restoreWallSize(plane) {
        if (!plane.scannedPositions)
            return;
        const scannedBounds = plane.mesh.getBoundingInfo();
        plane.mesh.setVerticesData(VertexBuffer.PositionKind, plane.scannedPositions);
        plane.mesh.setBoundingInfo(scannedBounds);
        plane.mesh.alwaysSelectAsActiveMesh = false;
        plane.scannedPositions = null;
    }
    createPreviewMaterial() {
        const material = new StandardMaterial("roomPreviewOccluder", this.scene);
        material.disableLighting = true;
        material.forceDepthWrite = true;
        return material;
    }
    placeGapPanels(wallMin, wallMax) {
        this.gapPanelMeshes.forEach((mesh) => mesh.dispose(false, true));
        this.gapPanelMeshes = gapPanels({ minX: wallMin.x, maxX: wallMax.x, minY: wallMin.y, maxY: wallMax.y }, this.gapWalls).map((panel) => {
            const mesh = MeshBuilder.CreatePlane("roomGapPanel", {
                width: panel.maxX - panel.minX,
                height: panel.maxY - panel.minY,
                sideOrientation: Mesh.DOUBLESIDE,
            }, this.scene);
            mesh.position.set((panel.minX + panel.maxX) / 2, (panel.minY + panel.maxY) / 2, wallMin.z);
            mesh.computeWorldMatrix(true);
            new OccluderPlane(mesh, this.scene);
            return mesh;
        });
    }
    isWall(plane) {
        return plane.xrPlane.semanticLabel === "wall";
    }
    // Safe to call repeatedly: only planes not yet processed are changed, so
    // planes that arrive late don't rebuild the portal.
    processPlanes(planes, facingRay) {
        if (this.choosingWall) {
            return;
        }
        const camera = this.scene.activeCamera;
        if (!camera) {
            return;
        }
        const forwardRay = facingRay ?? camera.getForwardRay();
        const newPlanes = planes.filter((plane) => !plane.processed && plane.mesh);
        newPlanes.forEach((plane) => {
            plane.facingPlane = this.findPlaneWithRay(plane, forwardRay);
        });
        if (!this.foundPlane) {
            const room = this.playerRoomState();
            if (room === "unscanned") {
                this.showMessage(UNSCANNED_MESSAGE);
                this.requestRoomCapture(UNSCANNED_MESSAGE);
                return;
            }
            this.foundPlane = this.findClosestFacingPlane(newPlanes.filter((plane) => this.inPlayerRoom(plane)), camera);
            if (!this.foundPlane) {
                if (planes.some((plane) => this.isWall(plane))) {
                    this.showMessage("Face a wall to start");
                }
                return;
            }
            log.debug("Wall found", this.foundPlane.id);
            this.hideMessage();
            this.alignToWall(this.foundPlane, camera);
        }
        newPlanes.forEach((plane) => {
            this.processSinglePlane(plane);
            plane.processed = true;
        });
        this.removeAnyPlanBehindFoundPlane(this.foundPlane, planes, camera);
    }
    alignToWall(wall, camera) {
        const matrix = this.wallAlignment
            ? wall.transformationMatrix.multiply(this.wallAlignment.getWorldMatrix())
            : wall.transformationMatrix;
        const normal = Vector3.TransformNormal(Vector3.Up(), matrix);
        normal.y = 0;
        normal.normalize();
        wall.mesh.computeWorldMatrix(true);
        const toWall = wall.mesh
            .getAbsolutePosition()
            .subtract(camera.globalPosition);
        const towardWall = Vector3.Dot(normal, toWall) < 0 ? normal.negate() : normal;
        this.turnWorld(-Math.atan2(towardWall.x, towardWall.z), camera);
    }
    turnWorld(byAngle, camera) {
        if (!this.wallAlignment) {
            this.wallAlignment = new TransformNode("wallAlignment", this.scene);
            camera.parent = this.wallAlignment;
        }
        const alignment = this.wallAlignment;
        alignment.rotation.y += byAngle;
        alignment.computeWorldMatrix(true);
        camera.computeWorldMatrix();
        this.planes.forEach((plane) => {
            if (plane.mesh) {
                plane.mesh.parent = alignment;
                plane.mesh.computeWorldMatrix(true);
            }
        });
    }
    startWallSearch() {
        this.stopWallSearch();
        this.wallSearchStart = Date.now();
        this.wallSearch = setInterval(() => this.searchForWall(), WALL_SEARCH_INTERVAL_MS);
    }
    stopWallSearch() {
        if (this.wallSearch) {
            clearInterval(this.wallSearch);
            this.wallSearch = 0;
        }
    }
    searchForWall() {
        if (this.foundPlane) {
            this.stopWallSearch();
            return;
        }
        if (this.lastCheck) {
            return; // planes are still arriving and will be processed when they stop
        }
        if (this.planes.some((plane) => this.isWall(plane))) {
            this.processPlanes(this.planes);
        }
        else if (Date.now() - this.wallSearchStart > PLANE_SCAN_TIMEOUT_MS) {
            this.requestRoomCapture();
        }
    }
    // Opens the headset's own room setup, for a player who chose to scan again. Resolves to
    // whether it started. The headset may allow it only once a session, and only from a press.
    async rescanRoom() {
        this.roomCaptureTried = true;
        try {
            await this.webXRPlaneDetector.initiateRoomCapture();
            return true;
        }
        catch (error) {
            log.warn("Couldn't start a room rescan", error);
            return false;
        }
    }
    requestRoomCapture(failed = "No suitable space found") {
        if (this.roomCaptureTried) {
            return;
        }
        this.roomCaptureTried = true;
        this.webXRPlaneDetector
            ?.initiateRoomCapture()
            .then(() => {
            log.debug("Room capture initiated");
        })
            .catch((error) => {
            log.error("Error initiating room capture", error);
            this.showMessage(failed);
        });
    }
    showMessage(message) {
        this.hideMessage();
        this.messageScreen = new ErrorScreenXR(this.scene, new Error(message));
    }
    hideMessage() {
        this.messageScreen?.dispose();
        this.messageScreen = null;
    }
    resetSession() {
        this.stopWallSearch();
        if (this.lastCheck) {
            clearInterval(this.lastCheck);
            this.lastCheck = 0;
        }
        this.lastCheckTime = 0;
        this.roomCaptureTried = false;
        this.choosingWall = false;
        this.endGapPreview();
        this.hideMessage();
        this.portal?.dispose();
        this.portal = null;
        this.skybox?.dispose(false, true);
        this.skybox = null;
        this.planes.forEach((plane) => this.removePlaneMesh(plane));
        this.planes = [];
        this.foundPlane = null;
        this.openPortalLater = null;
        if (this.xrHelper) {
            this.xrHelper.baseExperience.camera.parent = null;
        }
        this.wallAlignment?.dispose();
        this.wallAlignment = null;
    }
    processSinglePlane(plane) {
        const polygonMesh = plane.mesh;
        if (plane.id === this.foundPlane?.id) {
            this.processFoundPlane(polygonMesh, plane);
        }
        else {
            if (plane.facingPlane ||
                this.isFurnitureAtWall(plane, this.foundPlane) ||
                this.isPortalWallCopy(plane)) {
                // hide any walls behind the portal, and furniture right in front of it
                const material = new StandardMaterial("hidden", this.scene);
                material.alpha = 0.0;
                polygonMesh.material = material;
            }
            else {
                const solid = !NOT_FURNITURE.includes(plane.xrPlane.semanticLabel ?? "");
                new OccluderPlane(polygonMesh, this.scene, solid);
                if (this.isWall(plane) && this.foundPlane?.mesh) {
                    const { minimumWorld } = this.foundPlane.mesh.getBoundingInfo()
                        .boundingBox;
                    this.stretchWallPast(plane, minimumWorld.z);
                }
                if (solid) {
                    this.portal?.blockGlow(polygonMesh);
                }
            }
        }
    }
    // The wall must already face +Z.
    isFurnitureAtWall(plane, wall) {
        const label = plane.xrPlane.semanticLabel ?? "";
        if (NOT_FURNITURE.includes(label) || !wall?.mesh)
            return false;
        wall.mesh.computeWorldMatrix(true);
        plane.mesh.computeWorldMatrix(true);
        const wallZ = wall.mesh.getBoundingInfo().boundingBox.minimumWorld.z;
        const { maximumWorld } = plane.mesh.getBoundingInfo().boundingBox;
        const gap = wallZ - maximumWorld.z;
        log.debug("Furniture", label, "gap to wall", gap.toFixed(2));
        return gap < PORTAL_FURNITURE_GAP;
    }
    findClosestPlane(planes, camera) {
        const closestPlane = planes.reduce((prev, curr) => {
            if (!prev) {
                return curr;
            }
            const prevDistance = Vector3.Distance(camera.globalPosition, prev.mesh.getAbsolutePosition());
            const currDistance = Vector3.Distance(camera.globalPosition, curr.mesh.getAbsolutePosition());
            return prevDistance < currDistance ? prev : curr;
        }, null);
        return closestPlane;
    }
    findClosestFacingPlane(planes, camera) {
        const facingPlanes = planes.filter((plane) => plane.facingPlane === true);
        if (facingPlanes.length === 0) {
            return null;
        }
        return this.findClosestPlane(facingPlanes, camera);
    }
    processFoundPlane(polygonMesh, plane) {
        const boundingBox = polygonMesh.getBoundingInfo().boundingBox;
        const linePoints = plane.polygonDefinition.map((p) => new Vector3(p.x, 0, p.z));
        const wallToWorld = this.wallAlignment
            ? plane.transformationMatrix.multiply(this.wallAlignment.getWorldMatrix())
            : plane.transformationMatrix;
        this.openPortalLater = (start) => {
            this.createSkybox();
            this.portal = new Portal(linePoints, this.scene, wallToWorld, start);
        };
        const { minimumWorld, maximumWorld, centerWorld } = boundingBox;
        this.addSizeObservers.forEach((observer) => {
            observer({
                minX: minimumWorld.x,
                minY: minimumWorld.y,
                maxX: maximumWorld.x,
                maxY: maximumWorld.y,
                minZ: centerWorld.z,
                maxZ: centerWorld.z,
            });
        });
        const material = new StandardMaterial("clear", this.scene);
        material.alpha = 0.0;
        polygonMesh.material = material;
    }
    // The wall is found first, and the game decides when the portal opens on it.
    openPortal(start) {
        this.openPortalLater?.(start);
        this.openPortalLater = null;
    }
    // The wall straight ahead of the player, if any. Reads only.
    getFacedWall() {
        const camera = this.scene.activeCamera;
        if (!camera)
            return null;
        const walls = new Map();
        if (this.playerRoomState() === "unscanned")
            return null;
        this.planes.forEach((plane) => {
            if (plane.mesh && this.isWall(plane) && this.inPlayerRoom(plane))
                walls.set(plane.mesh, plane);
        });
        const picked = this.scene.pickWithRay(camera.getForwardRay(100, undefined, camera.globalPosition), (mesh) => walls.has(mesh));
        return picked?.hit ? walls.get(picked.pickedMesh) ?? null : null;
    }
    // Turns the world so this wall faces +Z, without choosing it.
    previewWall(wall) {
        const camera = this.scene.activeCamera;
        if (camera)
            this.alignToWall(wall, camera);
    }
    // Turns the world so the player looks along +Z, for showing text before any wall.
    faceHead() {
        const camera = this.scene.activeCamera;
        if (!camera)
            return;
        const { x, z } = camera.getForwardRay().direction;
        this.turnWorld(-Math.atan2(x, z), camera);
    }
    getWallPlanes() {
        return this.planes.filter((plane) => plane.mesh && this.isWall(plane));
    }
    // The furniture that paths and obstacles keep clear of when this wall is the portal. The wall
    // must already face +Z. Upright surfaces have no top to fly over, so they don't count.
    // Nor does furniture entirely beside the wall.
    getPathFurniturePlanes(wall) {
        const room = this.playerRoom(this.scene.activeCamera?.globalPosition);
        return this.planes.filter((plane) => {
            const label = plane.xrPlane.semanticLabel ?? "";
            if (!plane.mesh || NOT_FURNITURE.includes(label))
                return false;
            if (!this.inRoom(plane, room))
                return false;
            plane.mesh.computeWorldMatrix(true);
            const { minimumWorld, maximumWorld } = plane.mesh.getBoundingInfo().boundingBox;
            if (maximumWorld.y - minimumWorld.y > MAX_SURFACE_THICKNESS)
                return false;
            if (!wall?.mesh)
                return true;
            wall.mesh.computeWorldMatrix(true);
            const wallZ = wall.mesh.getBoundingInfo().boundingBox.minimumWorld.z;
            return wallZ - minimumWorld.z >= PORTAL_FURNITURE_GAP;
        });
    }
    // Chooses this wall, then carries on as if it had been found normally. The ray goes
    // through the wall, as the player may be looking elsewhere while aiming the pistol.
    lockWall(wall) {
        const camera = this.scene.activeCamera;
        if (!camera)
            return;
        this.previewWall(wall);
        this.choosingWall = false;
        this.foundPlane = wall;
        this.hideMessage();
        const center = wall.mesh.getBoundingInfo().boundingBox.centerWorld;
        const head = camera.globalPosition;
        this.processPlanes(this.planes, new Ray(head.clone(), center.subtract(head).normalize()));
    }
    getFurniture() {
        return this.getPathFurniturePlanes(this.foundPlane).map((plane) => {
            const { minimumWorld, maximumWorld } = plane.mesh.getBoundingInfo().boundingBox;
            return {
                minX: minimumWorld.x,
                maxX: maximumWorld.x,
                minZ: minimumWorld.z,
                maxZ: maximumWorld.z,
                topY: maximumWorld.y,
            };
        });
    }
    // Walls and ceilings other than the portal wall. Normals point into the room.
    // Only the player's own room, though other rooms' surfaces still hide the stars.
    getRoomSurfaces(head) {
        const surfaces = [];
        const room = this.playerRoom(head);
        this.planes.forEach((plane) => {
            const label = plane.xrPlane.semanticLabel ?? "";
            if (!plane.mesh || (label !== "wall" && label !== "ceiling"))
                return;
            if (!this.inRoom(plane, room))
                return;
            if (plane.id === this.foundPlane?.id || plane.facingPlane)
                return;
            plane.mesh.computeWorldMatrix(true);
            const { minimumWorld, maximumWorld, centerWorld } = plane.mesh.getBoundingInfo().boundingBox;
            const matrix = this.wallAlignment
                ? plane.transformationMatrix.multiply(this.wallAlignment.getWorldMatrix())
                : plane.transformationMatrix;
            const normal = Vector3.TransformNormal(Vector3.Up(), matrix).normalize();
            if (Vector3.Dot(normal, head.subtract(centerWorld)) < 0) {
                normal.scaleInPlace(-1);
            }
            surfaces.push({
                kind: label,
                point: { x: centerWorld.x, y: centerWorld.y, z: centerWorld.z },
                normal: { x: normal.x, y: normal.y, z: normal.z },
                minX: minimumWorld.x,
                maxX: maximumWorld.x,
                minY: minimumWorld.y,
                maxY: maximumWorld.y,
                minZ: minimumWorld.z,
                maxZ: maximumWorld.z,
            });
        });
        return surfaces;
    }
    getFloorY(fallback) {
        const floor = this.playerFloor(this.scene.activeCamera?.globalPosition) ??
            this.planes.find((plane) => plane.xrPlane.semanticLabel === "floor" && plane.mesh);
        return floor ? floor.mesh.getAbsolutePosition().y : fallback;
    }
    // The headset reports every room it has scanned. The player's is the floor under their head.
    playerFloor(head) {
        if (!head)
            return null;
        return (this.planes.find((plane) => {
            if (plane.xrPlane.semanticLabel !== "floor" || !plane.mesh)
                return false;
            plane.mesh.computeWorldMatrix(true);
            const { minimumWorld, maximumWorld } = plane.mesh.getBoundingInfo().boundingBox;
            return (head.x >= minimumWorld.x - ROOM_EDGE &&
                head.x <= maximumWorld.x + ROOM_EDGE &&
                head.z >= minimumWorld.z - ROOM_EDGE &&
                head.z <= maximumWorld.z + ROOM_EDGE);
        }) ?? null);
    }
    // Whether a wall of the player's room ends without meeting another, so one is missing.
    hasMissingWalls() {
        const floor = this.playerFloor(this.scene.activeCamera?.globalPosition);
        if (!floor)
            return false;
        const room = this.playerRoom(this.scene.activeCamera?.globalPosition);
        const walls = this.planes
            .filter((plane) => plane.mesh && this.isWall(plane) && this.inRoom(plane, room))
            .map((plane) => this.wallLine(plane));
        return openWallEnds(walls) > 0;
    }
    // A surface's outline, seen from above.
    outlineOf(plane) {
        const matrix = plane.mesh.computeWorldMatrix(true);
        const points = plane.polygonDefinition;
        const open = points[0] === points[points.length - 1] ? points.slice(0, -1) : points;
        return open.map((p) => {
            const world = Vector3.TransformCoordinates(new Vector3(p.x, 0, p.z), matrix);
            return { x: world.x, z: world.z };
        });
    }
    // A wall seen from above: the line between its two furthest apart corners.
    wallLine(plane) {
        const points = this.outlineOf(plane);
        let ends = [points[0], points[0]];
        let longest = -1;
        points.forEach((a) => points.forEach((b) => {
            const length = Math.hypot(a.x - b.x, a.z - b.z);
            if (length > longest) {
                longest = length;
                ends = [a, b];
            }
        }));
        return ends;
    }
    playerRoomState() {
        if (!this.planes.some((plane) => plane.xrPlane.semanticLabel === "floor" && plane.mesh)) {
            return "unknown";
        }
        return this.playerFloor(this.scene.activeCamera?.globalPosition) ? "scanned" : "unscanned";
    }
    // Whether this surface is part of the room the player stands in, or can't be ruled out.
    inPlayerRoom(plane) {
        return this.inRoom(plane, this.playerRoom(this.scene.activeCamera?.globalPosition));
    }
    // The player's floor, as a box. Null when no floor is under the head, so nothing is left out.
    playerRoom(head) {
        const floor = this.playerFloor(head);
        if (!floor)
            return null;
        const { minimumWorld, maximumWorld } = floor.mesh.getBoundingInfo().boundingBox;
        return { minX: minimumWorld.x, maxX: maximumWorld.x, minZ: minimumWorld.z, maxZ: maximumWorld.z };
    }
    inRoom(plane, room) {
        if (!room)
            return true;
        plane.mesh.computeWorldMatrix(true);
        const { minimumWorld, maximumWorld } = plane.mesh.getBoundingInfo().boundingBox;
        return (minimumWorld.x >= room.minX - ROOM_EDGE &&
            maximumWorld.x <= room.maxX + ROOM_EDGE &&
            minimumWorld.z >= room.minZ - ROOM_EDGE &&
            maximumWorld.z <= room.maxZ + ROOM_EDGE);
    }
    createSkybox() {
        const skybox = MeshBuilder.CreateBox("skyBox", { size: 700.0 }, this.scene);
        var skyboxMaterial = new StandardMaterial("skyBox", this.scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new Texture("/assets/images/NightSkybox.png", this.scene, true);
        skyboxMaterial.reflectionTexture.coordinatesMode =
            Texture.FIXED_EQUIRECTANGULAR_MODE;
        skyboxMaterial.disableLighting = true;
        skybox.material = skyboxMaterial;
        skybox.renderingGroupId = 1;
        this.skybox = skybox;
    }
    setupMovement(featureManager) {
        if (!this.xrHelper) {
            throw new Error("XR Helper not initialized");
        }
        const swappedHandednessConfiguration = [
            {
                allowedComponentTypes: [
                    WebXRControllerComponent.THUMBSTICK_TYPE,
                    WebXRControllerComponent.TOUCHPAD_TYPE,
                ],
                forceHandedness: "right",
                axisChangedHandler: () => { },
            },
            {
                allowedComponentTypes: [
                    WebXRControllerComponent.THUMBSTICK_TYPE,
                    WebXRControllerComponent.TOUCHPAD_TYPE,
                ],
                forceHandedness: "left",
                axisChangedHandler: () => { },
            },
        ];
        // add movement
        featureManager.enableFeature(WebXRFeatureName.MOVEMENT, "latest", {
            xrInput: this.xrHelper.input,
            // add options here
            movementSpeed: 0.5, // default 1
            rotationEnabled: false,
            movementOrientationFollowsViewerPose: false, // default true
            movementOrientationFollowsController: false, // enable controller direction
            customRegistrationConfigurations: swappedHandednessConfiguration,
        });
    }
    setupFeatures() {
        if (!this.xrHelper) {
            throw new Error("XR Helper not initialized");
        }
        const featureManager = this.xrHelper.baseExperience.featuresManager;
        this.setupMovement(featureManager);
        this.setupPlaneDetection(featureManager);
    }
    async enterVR(options = {}) {
        if (!this.xrHelper) {
            throw new Error("XR is not ready yet");
        }
        this.choosingWall = options.chooseWall === true;
        await this.xrHelper.baseExperience.enterXRAsync("immersive-ar", this.spaceType);
        log.debug("entered VR");
        this.startWallSearch();
    }
    isInXR() {
        return this.xrHelper?.baseExperience.state === WebXRState.IN_XR;
    }
    exitXR() {
        this.xrHelper?.baseExperience.exitXRAsync().then(() => {
            log.debug("exited VR");
        });
    }
    setupController() {
        this.controllers = new XRInputControllers(this.xrHelper);
    }
    getInstance() {
        if (!XREnvironment.instance) {
            XREnvironment.instance = new XREnvironment(this.scene);
        }
        return XREnvironment.instance;
    }
    dispose() {
        this.resetSession();
    }
}
