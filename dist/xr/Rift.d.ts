import { Scene } from "@babylonjs/core/scene";
import { Vec3 } from "../types/Geometry";
export declare class Rift {
    private scene;
    private root;
    private ring;
    private disc;
    private observer;
    private disposed;
    static prepare(scene: Scene): void;
    constructor(scene: Scene, point: Vec3, normal: Vec3);
    private animate;
    close(): void;
    dispose(): void;
}
