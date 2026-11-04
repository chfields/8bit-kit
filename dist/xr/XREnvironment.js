import { Ray } from "@babylonjs/core/Culling/ray";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Quaternion, Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { WebXRPlaneDetector } from "@babylonjs/core/XR/features/WebXRPlaneDetector";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllerComponent";
import { WebXRFeatureName } from "@babylonjs/core/XR/webXRFeaturesManager";
import { WebXRState } from "@babylonjs/core/XR/webXRTypes";
import { XRInputControllers } from "./XRInputControllers";
import earcut from "earcut";
import { OccluderPlane } from "./OccluderPlane";
import { Portal } from "./Portal";
import { ErrorScreenXR } from "../screen/ErrorScreenXR";
import { log } from "../game/Logger";
const PLANE_SCAN_TIMEOUT_MS = 5000;
const WALL_SEARCH_INTERVAL_MS = 500;
const NOT_FURNITURE = ["wall", "floor", "ceiling"];
const MAX_SURFACE_THICKNESS = 0.2;
// Furniture this close to the portal's wall doesn't cut into the portal, which draws over it.
const PORTAL_FURNITURE_GAP = 0.5;
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
    }
    createPolygonMesh(plane) {
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
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
    findBasedOnCamera(camera, planes, ray, findType = "wall") {
        // find all planes that are facing the camera
        const matchingPlanes = planes.filter((plane) => {
            return this.findPlaneWithRay(plane, ray, findType);
        });
        // find to the camera
        const foundPlane = this.findClosestPlane(matchingPlanes, camera);
        if (foundPlane) {
            return foundPlane;
        }
        return null;
    }
    findLeftWall(camera, planes) {
        const ray = new Ray(camera.globalPosition, camera.getDirection(new Vector3(-1, 0, 0)));
        return this.findBasedOnCamera(camera, planes, ray, "wall");
    }
    removePlaneMesh(plane) {
        if (plane.mesh) {
            plane.mesh.dispose(false, true);
            plane.mesh = null;
        }
    }
    removeAnyPlanBehindFoundPlane(foundPlane, planes, camera) {
        const foundPlaneBoundingBox = foundPlane.mesh.getBoundingInfo()
            .boundingBox;
        const foundPlaneZMin = foundPlaneBoundingBox.minimumWorld.z;
        const cameraZ = camera.globalPosition.z;
        // Read up front because this loop can remove the left wall's mesh.
        const leftWallX = this.findLeftWall(camera, planes)
            ?.mesh.getAbsolutePosition().x;
        for (let i = 0; i < planes.length; i++) {
            const plane = planes[i];
            if (plane.id === foundPlane.id) {
                continue;
            }
            if (!plane.mesh)
                continue;
            const planeBoundingBox = plane.mesh.getBoundingInfo()
                .boundingBox;
            const planeZMin = planeBoundingBox.minimumWorld.z;
            if (cameraZ < foundPlaneZMin) {
                // items that are fully behind the found plane
                if (planeZMin > foundPlaneZMin) {
                    this.removePlaneMesh(plane);
                }
                // items that are fully left of the left wall
                if (leftWallX !== undefined &&
                    planeBoundingBox.maximumWorld.x < leftWallX) {
                    this.removePlaneMesh(plane);
                }
            }
        }
    }
    isWall(plane) {
        return plane.xrPlane.semanticLabel === "wall";
    }
    // Safe to call repeatedly: only planes not yet processed are changed, so
    // planes that arrive late don't rebuild the portal.
    processPlanes(planes) {
        const camera = this.scene.activeCamera;
        if (!camera) {
            return;
        }
        const forwardRay = camera.getForwardRay();
        const newPlanes = planes.filter((plane) => !plane.processed && plane.mesh);
        newPlanes.forEach((plane) => {
            plane.facingPlane = this.findPlaneWithRay(plane, forwardRay);
        });
        if (!this.foundPlane) {
            this.foundPlane = this.findClosestFacingPlane(newPlanes, camera);
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
        const normal = Vector3.TransformNormal(Vector3.Up(), wall.transformationMatrix);
        normal.y = 0;
        normal.normalize();
        const toWall = wall.mesh
            .getAbsolutePosition()
            .subtract(camera.globalPosition);
        const towardWall = Vector3.Dot(normal, toWall) < 0 ? normal.negate() : normal;
        const alignment = new TransformNode("wallAlignment", this.scene);
        alignment.rotation.y = -Math.atan2(towardWall.x, towardWall.z);
        alignment.computeWorldMatrix(true);
        this.wallAlignment = alignment;
        camera.parent = alignment;
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
    requestRoomCapture() {
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
            this.showMessage("No suitable space found");
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
            if (plane.facingPlane || this.isFurnitureAtPortal(plane)) {
                // hide any walls behind the portal, and furniture right in front of it
                const material = new StandardMaterial("hidden", this.scene);
                material.alpha = 0.0;
                polygonMesh.material = material;
            }
            else {
                const solid = !NOT_FURNITURE.includes(plane.xrPlane.semanticLabel ?? "");
                new OccluderPlane(polygonMesh, this.scene, solid);
                if (solid) {
                    this.portal?.blockGlow(polygonMesh);
                }
            }
        }
    }
    isFurnitureAtPortal(plane) {
        const label = plane.xrPlane.semanticLabel ?? "";
        if (NOT_FURNITURE.includes(label) || !this.foundPlane?.mesh)
            return false;
        this.foundPlane.mesh.computeWorldMatrix(true);
        plane.mesh.computeWorldMatrix(true);
        const wallZ = this.foundPlane.mesh.getBoundingInfo().boundingBox.minimumWorld.z;
        const { maximumWorld } = plane.mesh.getBoundingInfo().boundingBox;
        const gap = wallZ - maximumWorld.z;
        log.debug("Furniture", label, "gap to portal wall", gap.toFixed(2));
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
    getFurniture() {
        const furniture = [];
        this.planes.forEach((plane) => {
            const label = plane.xrPlane.semanticLabel ?? "";
            if (!plane.mesh || NOT_FURNITURE.includes(label))
                return;
            plane.mesh.computeWorldMatrix(true);
            const { minimumWorld, maximumWorld } = plane.mesh.getBoundingInfo().boundingBox;
            // Upright surfaces, like the side of a cupboard, have no top to fly over.
            if (maximumWorld.y - minimumWorld.y > MAX_SURFACE_THICKNESS)
                return;
            furniture.push({
                minX: minimumWorld.x,
                maxX: maximumWorld.x,
                minZ: minimumWorld.z,
                maxZ: maximumWorld.z,
                topY: maximumWorld.y,
            });
        });
        return furniture;
    }
    // Walls and ceilings other than the portal wall. Normals point into the room.
    getRoomSurfaces(head) {
        const surfaces = [];
        this.planes.forEach((plane) => {
            const label = plane.xrPlane.semanticLabel ?? "";
            if (!plane.mesh || (label !== "wall" && label !== "ceiling"))
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
        const floor = this.planes.find((plane) => plane.xrPlane.semanticLabel === "floor" && plane.mesh);
        return floor ? floor.mesh.getAbsolutePosition().y : fallback;
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
    async enterVR() {
        if (!this.xrHelper) {
            throw new Error("XR is not ready yet");
        }
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
