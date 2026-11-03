import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Observer } from "@babylonjs/core/Misc/observable";
import { BoxParticleEmitter } from "@babylonjs/core/Particles/EmitterTypes/boxParticleEmitter";
import { ParticleHelper } from "@babylonjs/core/Particles/particleHelper";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { log } from "../game/Logger";

const EDGE_THICKNESS = 0.05;
export const PORTAL_REVEAL_MS = 1200;
// In front of the wall so the panels also hide anything placed right on it.
const MASK_IN_FRONT_OF_WALL = 0.01;

// Where on the wall the portal starts opening from.
export type PortalStart = {
  center: Vector3;
  width: number;
  height: number;
  // How long it stays at this size before growing.
  holdMs: number;
};

type PortalEdge = {
  box: AbstractMesh;
  // From the portal's centre towards the middle of this edge.
  outward: Vector3;
  runsAlongWidth: boolean;
  fullLength: number;
};

export class Portal {
  private scene: Scene;
  private linePoints: Vector3[];
  private wallToWorld: Matrix;
  private start: PortalStart;
  private boxes: AbstractMesh[] = [];
  private edges: PortalEdge[] = [];
  private maskPanels: Mesh[] = [];
  private particleSystems: any[] = [];
  private glowLayer: GlowLayer | null = null;
  private disposed: boolean = false;
  private revealObserver: Nullable<Observer<Scene>> = null;

  constructor(
    linePoints: Vector3[],
    scene: Scene,
    wallToWorld: Matrix,
    start: PortalStart
  ) {
    this.scene = scene;
    this.linePoints = linePoints;
    this.wallToWorld = wallToWorld;
    this.start = start;
    this.createPortal();
  }

  private createPortal() {
    const material = this.createNeonMaterial();
    this.glowLayer = this.createGlowLayer();
    const matrix = this.wallToWorld;
    const wallNormal = Vector3.TransformNormal(Vector3.Up(), matrix).normalize();

    const corners = this.rectangleCorners().map((corner) =>
      Vector3.TransformCoordinates(corner, matrix)
    );
    const center = corners[0].add(corners[2]).scale(0.5);
    corners.forEach((start, index) => {
      const end = corners[(index + 1) % corners.length];
      const box = this.createEdge(start, end, wallNormal, material);
      this.edges.push({
        box,
        outward: start.add(end).scale(0.5).subtract(center),
        runsAlongWidth: index % 2 === 0,
        fullLength: Vector3.Distance(start, end),
      });
    });

    const width = Vector3.Distance(corners[0], corners[1]);
    const height = Vector3.Distance(corners[1], corners[2]);
    this.reveal(center, wallNormal, width, height);
  }

  // Starts at the given place on the wall and grows to the full portal, smoking
  // and glowing all the way.
  private reveal(
    center: Vector3,
    wallNormal: Vector3,
    width: number,
    height: number
  ) {
    const heightAxis = this.edges[0].outward.normalizeToNew();
    const widthAxis = Vector3.Cross(wallNormal, heightAxis).normalize();
    const placeMask = this.createMask(
      center,
      wallNormal,
      widthAxis,
      heightAxis,
      width,
      height
    );
    // Flattened onto the wall, in case the start isn't exactly on it.
    const fromCenter = this.start.center.subtract(center);
    const startCenter = center
      .add(widthAxis.scale(Vector3.Dot(fromCenter, widthAxis)))
      .add(heightAxis.scale(Vector3.Dot(fromCenter, heightAxis)));

    const applySize = (
      openCenter: Vector3,
      openWidth: number,
      openHeight: number
    ) => {
      this.edges.forEach((edge) => {
        const edgeLength = edge.runsAlongWidth ? openWidth : openHeight;
        const distance = edge.runsAlongWidth ? openHeight / 2 : openWidth / 2;
        edge.box.position.copyFrom(
          openCenter.add(edge.outward.normalizeToNew().scale(distance))
        );
        edge.box.scaling.x =
          (edgeLength + EDGE_THICKNESS) / (edge.fullLength + EDGE_THICKNESS);
      });
      placeMask(openCenter, openWidth, openHeight);
    };
    applySize(startCenter, this.start.width, this.start.height);

    const startTime = performance.now();
    this.revealObserver = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() - startTime - this.start.holdMs;
      const progress = Math.min(Math.max(elapsed, 0) / PORTAL_REVEAL_MS, 1);
      // Starts slowly, then opens quickly.
      const eased = progress * progress * (3 - 2 * progress);
      applySize(
        Vector3.Lerp(startCenter, center, eased),
        this.start.width + (width - this.start.width) * eased,
        this.start.height + (height - this.start.height) * eased
      );
      if (progress >= 1) {
        this.stopReveal();
      }
    });
  }

  // Invisible panels that write depth, like the room's occluders, covering the
  // wall outside the opening. Returns a function that moves them to fit a size.
  private createMask(
    center: Vector3,
    wallNormal: Vector3,
    widthAxis: Vector3,
    heightAxis: Vector3,
    width: number,
    height: number
  ) {
    const material = new StandardMaterial("portalMask", this.scene);
    material.disableLighting = true;
    material.forceDepthWrite = true;

    const camera = this.scene.activeCamera;
    const towardPlayer =
      camera &&
      Vector3.Dot(wallNormal, camera.globalPosition.subtract(center)) < 0
        ? wallNormal.negate()
        : wallNormal;
    const inFront = towardPlayer.scale(MASK_IN_FRONT_OF_WALL);
    const rotation = Quaternion.RotationQuaternionFromAxis(
      widthAxis,
      heightAxis,
      wallNormal
    );

    const createPanel = (panelWidth: number, panelHeight: number) => {
      const panel = MeshBuilder.CreateBox(
        "portalMask",
        { width: panelWidth, height: panelHeight, depth: 0.001 },
        this.scene
      );
      panel.rotationQuaternion = rotation.clone();
      panel.material = material;
      panel.visibility = 0.001;
      panel.renderingGroupId = 0;
      panel.isPickable = false;
      this.maskPanels.push(panel);
      return panel;
    };
    // Twice the wall's size, so they still cover it with the opening off-centre.
    // The side panels are extra tall so they also cover the corners.
    const left = createPanel(width * 2, height * 5);
    const right = createPanel(width * 2, height * 5);
    const top = createPanel(width * 2, height * 2);
    const bottom = createPanel(width * 2, height * 2);

    return (openCenter: Vector3, openWidth: number, openHeight: number) => {
      const maskCenter = openCenter.add(inFront);
      const sideOffset = openWidth / 2 + width;
      const endOffset = openHeight / 2 + height;
      left.position.copyFrom(maskCenter.add(widthAxis.scale(-sideOffset)));
      right.position.copyFrom(maskCenter.add(widthAxis.scale(sideOffset)));
      top.position.copyFrom(maskCenter.add(heightAxis.scale(endOffset)));
      bottom.position.copyFrom(maskCenter.add(heightAxis.scale(-endOffset)));
    };
  }

  private stopReveal() {
    if (this.revealObserver) {
      this.scene.onBeforeRenderObservable.remove(this.revealObserver);
      this.revealObserver = null;
    }
    this.maskPanels.forEach((panel) => panel.dispose(false, true));
    this.maskPanels = [];
  }

  // The headset's outline can be noisy or have extra points, so the border uses
  // the outline's bounding rectangle in the wall's own coordinates.
  private rectangleCorners(): Vector3[] {
    const xs = this.linePoints.map((point) => point.x);
    const zs = this.linePoints.map((point) => point.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    return [
      new Vector3(minX, 0, minZ),
      new Vector3(maxX, 0, minZ),
      new Vector3(maxX, 0, maxZ),
      new Vector3(minX, 0, maxZ),
    ];
  }

  private createEdge(
    start: Vector3,
    end: Vector3,
    wallNormal: Vector3,
    material: StandardMaterial
  ) {
    const length = Vector3.Distance(start, end);
    // Extra length overlaps the neighbouring edges to make solid square corners.
    const box = MeshBuilder.CreateBox(
      "portalEdgeBox",
      {
        width: length + EDGE_THICKNESS,
        height: EDGE_THICKNESS,
        depth: EDGE_THICKNESS,
      },
      this.scene
    );
    box.renderingGroupId = 0;
    box.material = material;
    box.position = start.add(end).scale(0.5);

    // Local X runs along the edge and local Z along the wall's normal, so every
    // edge lies flat against the wall at any wall angle.
    const direction = end.subtract(start).normalize();
    const inWall = Vector3.Cross(wallNormal, direction);
    box.rotationQuaternion = Quaternion.RotationQuaternionFromAxis(
      direction,
      inWall,
      wallNormal
    );

    this.glowLayer?.addIncludedOnlyMesh(box);
    this.createParticleSystem(box, length);
    this.boxes.push(box);
    return box;
  }

  private createNeonMaterial() {
    const neonMaterial = new StandardMaterial("neonMaterial", this.scene);
    neonMaterial.emissiveColor = new Color3(0.35, 0.96, 0.88);
    return neonMaterial;
  }

  private createGlowLayer() {
    return new GlowLayer("glow", this.scene, {
      mainTextureSamples: 4,
      mainTextureFixedSize: 256,
      blurKernelSize: 100,
    });
  }

  private createParticleSystem(box: AbstractMesh, length: number) {
    ParticleHelper.ParseFromSnippetAsync("UY098C#488", this.scene, false)
      .then((system) => {
        if (this.disposed) {
          system.dispose();
          return;
        }
        system.emitter = box;
        // Emit along the edge itself, in the box's local X direction. The emitter
        // follows the box's scale, so the smoke grows with the portal.
        const emitter = new BoxParticleEmitter();
        emitter.minEmitBox = new Vector3(-length / 2, 0, 0);
        emitter.maxEmitBox = new Vector3(length / 2, 0, 0);
        emitter.direction1 = new Vector3(-1, -1, -1);
        emitter.direction2 = new Vector3(1, 1, 1);
        system.particleEmitterType = emitter;
        this.particleSystems.push(system);
      })
      .catch((error) => {
        // The effect is loaded from Babylon's snippet server and is only decoration.
        log.warn("Portal particles not loaded", error);
      });
  }

  public dispose() {
    this.disposed = true;
    this.stopReveal();
    this.particleSystems.forEach((system) => system.dispose());
    this.particleSystems = [];
    this.glowLayer?.dispose();
    this.glowLayer = null;
    this.boxes.forEach((box) => {
      box.dispose(false, true);
    });
    this.boxes = [];
  }
}
