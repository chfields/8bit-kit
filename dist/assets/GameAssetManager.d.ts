import { ISceneLoaderAsyncResult } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
export type SoundEntry = {
    name: string;
    path: string;
    options: Record<string, unknown>;
};
export type MeshEntry = {
    file: string;
    setup: (assets: ISceneLoaderAsyncResult, add: (mesh: AbstractMesh) => void) => void;
};
export type GameAssets = {
    sounds: SoundEntry[];
    meshes: MeshEntry[];
};
export declare class GameAssetManager {
    private static assets;
    private static instance;
    private scene;
    private assetContainer;
    private sounds;
    private audioEngine;
    private rootMesh;
    private meshesLoaded;
    private soundsLoaded;
    private meshesReady;
    static configure(assets: GameAssets): void;
    private constructor();
    static getInstance(scene: Scene): GameAssetManager;
    static existingInstance(): GameAssetManager;
    private pushToAssetsContainer;
    private loadMesh;
    private loadSound;
    private loadSounds;
    playSound(name: string, mesh?: AbstractMesh, playbackRate?: number): void;
    stopSound(name: string): void;
    loadAssets(): Promise<void>;
    whenMeshesLoaded(): Promise<void>;
    loaded(): boolean;
    clone(name: string, newName?: string | null): AbstractMesh;
}
