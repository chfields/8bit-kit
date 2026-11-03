import { Ray } from "@babylonjs/core/Culling/ray";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
import { GameAssetManager } from "../assets/GameAssetManager";
export type PlayerBulletOptions = {
    collisionMask: number;
    destroys: string[];
    onCollision?: (mesh: AbstractMesh) => boolean;
};
export declare class PlayerBullet {
    private static options;
    static configure(options: PlayerBulletOptions): void;
    private scene;
    private controllerRay;
    private bullet;
    private bulletObserver;
    private bulletSpeed;
    private maxDistance;
    private distanceTravelled;
    private gameAssetManager;
    disposed: boolean;
    constructor(scene: Scene, assetManager: GameAssetManager, controllerRay: Ray);
    private createBullet;
    private startBulletLoop;
    private handleCollision;
    private destroyBullet;
}
