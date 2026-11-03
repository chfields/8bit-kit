import { CreateSoundAsync } from "@babylonjs/core/AudioV2/abstractAudio/audioEngineV2";
import { CreateAudioEngineAsync } from "@babylonjs/core/AudioV2/webAudio/webAudioEngine";
import { SceneLoader, } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AssetContainer } from "@babylonjs/core/assetContainer";
import { log } from "../game/Logger";
export class GameAssetManager {
    // Each game calls this once at startup, before anything creates the manager.
    static configure(assets) {
        GameAssetManager.assets = assets;
    }
    constructor(scene) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "assetContainer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sounds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "audioEngine", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "rootMesh", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "meshesLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "soundsLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "meshesReady", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        if (!GameAssetManager.assets) {
            throw new Error("GameAssetManager.configure must be called first");
        }
        this.scene = scene;
        /// create a root mesh to hold all the assets
        this.rootMesh = new Mesh("root", scene);
        this.assetContainer = new AssetContainer(scene);
        this.sounds = new Map();
        this.meshesReady = this.loadAssets();
        (async () => {
            this.audioEngine = await CreateAudioEngineAsync();
            this.audioEngine.volume = 0.75;
            this.loadSounds();
        })();
    }
    static getInstance(scene) {
        if (!GameAssetManager.instance) {
            GameAssetManager.instance = new GameAssetManager(scene);
        }
        return GameAssetManager.instance;
    }
    static existingInstance() {
        if (!GameAssetManager.instance) {
            throw new Error("GameAssetManager not initialized");
        }
        return GameAssetManager.instance;
    }
    pushToAssetsContainer(mesh) {
        this.assetContainer.meshes.push(mesh);
    }
    async loadMesh(name) {
        return SceneLoader.ImportMeshAsync("", "/assets/models/", name, this.scene);
    }
    async loadSound(name, assetName, options) {
        const sound = await CreateSoundAsync(name, assetName, options, this.audioEngine);
        this.sounds.set(name, sound);
        return sound;
    }
    async loadSounds() {
        const promises = GameAssetManager.assets.sounds.map((sound) => this.loadSound(sound.name, sound.path, sound.options));
        await Promise.all(promises);
        this.soundsLoaded = true;
        log.debug("All sounds loaded");
    }
    playSound(name, mesh, playbackRate = 1) {
        const sound = this.sounds.get(name);
        if (sound) {
            sound.playbackRate = playbackRate;
            if (mesh) {
                sound.spatial.attach(mesh);
            }
            else {
                sound.spatial.detach();
            }
            sound.play();
        }
    }
    stopSound(name) {
        const sound = this.sounds.get(name);
        if (sound) {
            sound.stop();
        }
    }
    async loadAssets() {
        const promises = GameAssetManager.assets.meshes.map((entry) => this.loadMesh(entry.file).then((assets) => {
            entry.setup(assets, (mesh) => this.pushToAssetsContainer(mesh));
        }));
        // wait for all the promises to resolve
        await Promise.all(promises);
        this.assetContainer.removeAllFromScene();
        this.meshesLoaded = true;
        log.debug("All meshes loaded");
    }
    whenMeshesLoaded() {
        return this.meshesReady;
    }
    loaded() {
        return this.meshesLoaded && this.soundsLoaded;
    }
    clone(name, newName = null) {
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
Object.defineProperty(GameAssetManager, "assets", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
