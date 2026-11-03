import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { DefaultGameFont } from "../assets/Fonts";
export class UIText {
    static createTextBlock(text, fontSize, color = 'white') {
        const textBlock = new TextBlock();
        textBlock.text = text;
        textBlock.color = color;
        textBlock.fontSize = fontSize;
        textBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        textBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        textBlock.fontFamily = `'${DefaultGameFont}'`;
        return textBlock;
    }
    static createTextMesh(scene, name, textBlock, xrRange, positionName, scale = 1) {
        const { minX, maxX } = xrRange;
        const mesh = MeshBuilder.CreatePlane(name, { width: (maxX - minX) / 4 * scale, height: 0.5 * scale }, scene);
        mesh.renderingGroupId = 1;
        const texture = AdvancedDynamicTexture.CreateForMesh(mesh, 512, 256);
        texture.addControl(textBlock);
        if (positionName) {
            UIText.positionMesh(mesh, positionName, xrRange);
        }
        return { mesh, texture };
    }
    static positionMesh(mesh, namedLocation, xrRange) {
        // left, right or center
        const { minX, maxX, maxY, minZ } = xrRange;
        switch (namedLocation) {
            case "left":
                mesh.position = new Vector3(minX + mesh.scaling.x / 2 + mesh.scaling.x / 4, maxY - 0.2, minZ);
                break;
            case "right":
                mesh.position = new Vector3(maxX - mesh.scaling.x / 2 - mesh.scaling.x / 4, maxY - 0.2, minZ);
                break;
            case "center":
                mesh.position = new Vector3(minX + (maxX - minX) / 2, maxY - 0.2, minZ);
                break;
        }
    }
}
