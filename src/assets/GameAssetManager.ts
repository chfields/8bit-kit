import { AudioEngineV2, CreateSoundAsync } from "@babylonjs/core/AudioV2/abstractAudio/audioEngineV2";
import { StaticSound } from "@babylonjs/core/AudioV2/abstractAudio/staticSound";
import { CreateAudioEngineAsync } from "@babylonjs/core/AudioV2/webAudio/webAudioEngine";
import {
  ISceneLoaderAsyncResult,
  SceneLoader,
} from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { AssetContainer } from "@babylonjs/core/assetContainer";
import { log } from "../game/Logger";

export type SoundEntry = {
  name: string;
  path: string;
  options: Record<string, unknown>;
};

export type MeshEntry = {
  // A file in /assets/models/.
  file: string;
  // Positions the loaded meshes, and adds the ones to keep for cloning.
  setup: (
    assets: ISceneLoaderAsyncResult,
    add: (mesh: AbstractMesh) => void
  ) => void;
};

export type GameAssets = {
  sounds: SoundEntry[];
  meshes: MeshEntry[];
};

export class GameAssetManager {
  private static assets: GameAssets | null = null;
  private static instance: GameAssetManager;
  private scene: Scene;
  private assetContainer: AssetContainer;
  private sounds: Map<string, StaticSound>;
  private audioEngine: Nullable<AudioEngineV2> = null;
  private rootMesh: AbstractMesh;
  private meshesLoaded: boolean = false;
  private soundsLoaded: boolean = false;
  private meshesReady: Promise<void>;

  // Each game calls this once at startup, before anything creates the manager.
  public static configure(assets: GameAssets): void {
    GameAssetManager.assets = assets;
  }

  private constructor(scene: Scene) {
    if (!GameAssetManager.assets) {
      throw new Error("GameAssetManager.configure must be called first");
    }
    this.scene = scene;
    /// create a root mesh to hold all the assets
    this.rootMesh = new Mesh("root", scene);
    this.assetContainer = new AssetContainer(scene);
    this.sounds = new Map<string, StaticSound>();
    this.meshesReady = this.loadAssets();
    (async () => {
      this.audioEngine = await CreateAudioEngineAsync();
      this.audioEngine.volume = 0.75;
      this.loadSounds();
    })();
  }

  public static getInstance(scene: Scene): GameAssetManager {
    if (!GameAssetManager.instance) {
      GameAssetManager.instance = new GameAssetManager(scene);
    }

    return GameAssetManager.instance;
  }
  public static existingInstance(): GameAssetManager {
    if (!GameAssetManager.instance) {
      throw new Error("GameAssetManager not initialized");
    }
    return GameAssetManager.instance;
  }

  private pushToAssetsContainer(mesh: AbstractMesh): void {
    this.assetContainer.meshes.push(mesh);
  }

  private async loadMesh(name: string) {
    return SceneLoader.ImportMeshAsync("", "/assets/models/", name, this.scene);
  }

  private async loadSound(name: string, assetName: string, options: any) {
    const sound = await CreateSoundAsync(
      name,
      assetName,
      options,
      this.audioEngine
    );
    this.sounds.set(name, sound);
    return sound;
  }

  private async loadSounds() {
    const promises = GameAssetManager.assets!.sounds.map((sound) =>
      this.loadSound(sound.name, sound.path, sound.options)
    );
    await Promise.all(promises);
    this.soundsLoaded = true;
    log.debug("All sounds loaded");
  }

  public playSound(
    name: string,
    mesh?: AbstractMesh,
    playbackRate: number = 1
  ): void {
    const sound = this.sounds.get(name);
    if (sound) {
      sound.playbackRate = playbackRate;
      if (mesh) {
        sound.spatial.attach(mesh);
      } else {
        sound.spatial.detach();
      }
      sound.play();
    }
  }

  public stopSound(name: string): void {
    const sound = this.sounds.get(name);
    if (sound) {
      sound.stop();
    }
  }

  public async loadAssets(): Promise<void> {
    const promises = GameAssetManager.assets!.meshes.map((entry) =>
      this.loadMesh(entry.file).then((assets) => {
        entry.setup(assets, (mesh) => this.pushToAssetsContainer(mesh));
      })
    );

    // wait for all the promises to resolve
    await Promise.all(promises);
    this.assetContainer.removeAllFromScene();
    this.meshesLoaded = true;
    log.debug("All meshes loaded");
  }

  public whenMeshesLoaded(): Promise<void> {
    return this.meshesReady;
  }

  public loaded(): boolean {
    return this.meshesLoaded && this.soundsLoaded;
  }

  public clone(name: string, newName: string | null = null): AbstractMesh {
    if (!newName) {
      newName = "id" + Math.floor(Math.random() * 1000000).toString(16);
    }
    let newMesh = null;
    let sourceMesh = this.assetContainer.meshes.filter((mesh) => {
      return mesh.name === name;
    });

    if (sourceMesh.length) {
      newMesh = sourceMesh[0].clone(newName, this.rootMesh);
      if (newMesh) {
        newMesh.name = newName;
      }
    }
    if (!newMesh) {
      log.error("Mesh not found", name);
      throw new Error("Mesh not found " + name);
    }
    return newMesh;
  }
}
