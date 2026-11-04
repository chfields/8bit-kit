import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
export declare const PORTAL_REVEAL_MS = 1200;
export type PortalStart = {
    center: Vector3;
    width: number;
    height: number;
    holdMs: number;
};
export declare class Portal {
    private scene;
    private linePoints;
    private wallToWorld;
    private start;
    private boxes;
    private edges;
    private maskPanels;
    private particleSystems;
    private glowLayer;
    private revealObserver;
    constructor(linePoints: Vector3[], scene: Scene, wallToWorld: Matrix, start: PortalStart);
    private createPortal;
    private reveal;
    private createMask;
    private stopReveal;
    private rectangleCorners;
    private createEdge;
    private createNeonMaterial;
    private createGlowLayer;
    blockGlow(mesh: Mesh): void;
    private createParticleSystem;
    dispose(): void;
}
