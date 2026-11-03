import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { VoxelText, voxelTextWidth } from "../effects/VoxelText";
import { XRRange } from "../xr/XREnvironment";

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

type HudItem = { text: string; voxels: VoxelText };

export class Hud {
  private scene: Scene;
  private xrRange: XRRange;
  private cubeSize: number;
  private score: HudItem;
  private lives: HudItem;
  private level: HudItem;
  private flashTimer: ReturnType<typeof setInterval> | null = null;

  constructor(scene: Scene, range: XRRange, options: { longestText: string }) {
    this.scene = scene;
    this.xrRange = range;
    this.cubeSize = Math.min(
      ((range.maxX - range.minX) * WIDTH_OF_WALL) /
        voxelTextWidth(options.longestText, 1),
      MAX_CUBE_SIZE
    );
    this.score = this.createItem("SCORE 0", COLUMN_POSITIONS.score, SCORE_COLOR);
    this.lives = this.createItem("LIVES 3", COLUMN_POSITIONS.lives, LIVES_COLOR);
    this.level = this.createItem("LEVEL 1", COLUMN_POSITIONS.level, LEVEL_COLOR);
  }

  private createItem(text: string, column: number, color: Color3): HudItem {
    const { minX, maxX, maxY, minZ } = this.xrRange;
    const voxels = new VoxelText(
      this.scene,
      text,
      new Vector3(
        minX + (maxX - minX) * column,
        maxY - HUD_TOP_OF_WALL,
        minZ - HUD_IN_FRONT_OF_WALL
      ),
      this.cubeSize,
      color,
      false
    );
    return { text, voxels };
  }

  private replaceItem(
    item: HudItem,
    text: string,
    column: number,
    color: Color3
  ): HudItem {
    if (item.text === text) {
      return item;
    }
    item.voxels.dispose();
    return this.createItem(text, column, color);
  }

  public updateScore(score: number): void {
    this.score = this.replaceItem(
      this.score,
      `SCORE ${score}`,
      COLUMN_POSITIONS.score,
      SCORE_COLOR
    );
  }

  public updateLives(lives: number): void {
    this.lives = this.replaceItem(
      this.lives,
      `LIVES ${lives}`,
      COLUMN_POSITIONS.lives,
      LIVES_COLOR
    );
  }

  public updateLevel(level: number): void {
    this.level = this.replaceItem(
      this.level,
      `LEVEL ${level}`,
      COLUMN_POSITIONS.level,
      LEVEL_COLOR
    );
  }

  // Blinks the lives text brighter when a life is earned.
  public flashLives(): void {
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

  private stopFlash(): void {
    if (this.flashTimer) {
      clearInterval(this.flashTimer);
      this.flashTimer = null;
    }
    this.lives.voxels.setHighlighted(false);
  }

  public dispose(): void {
    this.stopFlash();
    this.score.voxels.dispose();
    this.lives.voxels.dispose();
    this.level.voxels.dispose();
  }
}
