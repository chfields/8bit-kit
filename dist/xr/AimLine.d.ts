import { Ray } from "@babylonjs/core/Culling/ray";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
export type AimLineShape = {
    length: number;
    faded: boolean;
};
export declare function aimLineShape(target: number | null, length: number): AimLineShape;
export declare function aimLineAlpha(along: number, faded: boolean): number;
export type AimLineOptions = {
    scene: Scene;
    getAimRay: () => Nullable<Ray>;
    color?: Color3;
    length?: number;
};
export declare class AimLine {
    private scene;
    private getAimRay;
    private color;
    private length;
    private mesh;
    private material;
    private observer;
    private fadedColors;
    private solidColors;
    private shownFaded;
    private scale;
    private disposed;
    constructor(options: AimLineOptions);
    private vertexColors;
    private follow;
    setTarget(distance: number | null, color?: Color3): void;
    dispose(): void;
}
