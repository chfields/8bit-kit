import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { VoxelText, voxelTextWidth } from "../effects/VoxelText";
const HUD_TOP_OF_WALL = 0.17;
const HUD_IN_FRONT_OF_WALL = 0.05;
const COLUMN_POSITIONS = { lives: 0.17, level: 0.5, score: 0.83 };
// Sized to fit the longest expected text in about a fifth of the wall.
const WIDTH_OF_WALL = 0.2;
const MAX_CUBE_SIZE = 0.016;
const SCORE_COLOR = new Color3(1, 1, 1);
const LIVES_COLOR = new Color3(0.3, 1, 0.4);
const LEVEL_COLOR = new Color3(1, 0.85, 0.1);
const FLASH_COUNT = 4;
const FLASH_STEP_MS = 120;
export class Hud {
    constructor(scene, range, options) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "xrRange", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cubeSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "score", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lives", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "level", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "flashTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.scene = scene;
        this.xrRange = range;
        this.cubeSize = Math.min(((range.maxX - range.minX) * WIDTH_OF_WALL) /
            voxelTextWidth(options.longestText, 1), MAX_CUBE_SIZE);
        this.score = this.createItem("SCORE 0", COLUMN_POSITIONS.score, SCORE_COLOR);
        this.lives = this.createItem("LIVES 3", COLUMN_POSITIONS.lives, LIVES_COLOR);
        this.level = this.createItem("LEVEL 1", COLUMN_POSITIONS.level, LEVEL_COLOR);
    }
    createItem(text, column, color) {
        const { minX, maxX, maxY, minZ } = this.xrRange;
        const voxels = new VoxelText(this.scene, text, new Vector3(minX + (maxX - minX) * column, maxY - HUD_TOP_OF_WALL, minZ - HUD_IN_FRONT_OF_WALL), this.cubeSize, color, false);
        return { text, voxels };
    }
    replaceItem(item, text, column, color) {
        if (item.text === text) {
            return item;
        }
        item.voxels.dispose();
        return this.createItem(text, column, color);
    }
    updateScore(score) {
        this.score = this.replaceItem(this.score, `SCORE ${score}`, COLUMN_POSITIONS.score, SCORE_COLOR);
    }
    updateLives(lives) {
        this.lives = this.replaceItem(this.lives, `LIVES ${lives}`, COLUMN_POSITIONS.lives, LIVES_COLOR);
    }
    updateLevel(level) {
        this.level = this.replaceItem(this.level, `LEVEL ${level}`, COLUMN_POSITIONS.level, LEVEL_COLOR);
    }
    // Blinks the lives text brighter when a life is earned.
    flashLives() {
        this.stopFlash();
        let step = 0;
        this.flashTimer = setInterval(() => {
            this.lives.voxels.setHighlighted(step % 2 === 0);
            step++;
            if (step >= FLASH_COUNT * 2) {
                this.stopFlash();
            }
        }, FLASH_STEP_MS);
    }
    stopFlash() {
        if (this.flashTimer) {
            clearInterval(this.flashTimer);
            this.flashTimer = null;
        }
        this.lives.voxels.setHighlighted(false);
    }
    dispose() {
        this.stopFlash();
        this.score.voxels.dispose();
        this.lives.voxels.dispose();
        this.level.voxels.dispose();
    }
}
