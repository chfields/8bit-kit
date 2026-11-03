import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
import { XRRange } from "../xr/XRRange";
export declare class UIText {
    static createTextBlock(text: string, fontSize: number, color?: string): TextBlock;
    static createTextMesh(scene: Scene, name: string, textBlock: TextBlock, xrRange: XRRange, positionName?: string, scale?: number): {
        mesh: AbstractMesh;
        texture: AdvancedDynamicTexture;
    };
    static positionMesh(mesh: AbstractMesh, namedLocation: string, xrRange: XRRange): void;
}
