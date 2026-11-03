export declare class HighScore {
    private static instance;
    private highScore;
    private scoreListeners;
    private constructor();
    private loadHighScore;
    private saveHighScore;
    static getInstance(): HighScore;
    getHighScore(): number;
    checkAndUpdateHighScore(newScore: number): void;
    addScoreListener(listener: (score: number) => void): void;
    removeScoreListener(listener: (score: number) => void): void;
    notifyScoreListeners(): void;
}
