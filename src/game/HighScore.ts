

export class HighScore {
    private static instance: HighScore;
    private highScore: number;
    private scoreListeners : ((score: number) => void)[] = [];

    private constructor() {
        this.highScore = 0;
        this.loadHighScore();
    }

    private loadHighScore(): void {
        const storedScore = localStorage.getItem("highScore");
        if (storedScore) {
            this.highScore = parseInt(storedScore, 10);
        } else {
            this.highScore = 0;
        }
    }

    private async saveHighScore(): Promise<void> {
        localStorage.setItem("highScore", this.highScore.toString());
    }

    public static getInstance(): HighScore {
        if (!HighScore.instance) {
            HighScore.instance = new HighScore();
        }
        return HighScore.instance;
    }

    public getHighScore(): number {
        return this.highScore;
    }

    public checkAndUpdateHighScore(newScore: number): void {
        if (newScore > this.highScore) {
            this.highScore = newScore;
            this.saveHighScore();
            this.notifyScoreListeners();
        }
    }

    public addScoreListener(listener: (score: number) => void): void {
        this.scoreListeners.push(listener);
    }
    public removeScoreListener(listener: (score: number) => void): void {
        this.scoreListeners = this.scoreListeners.filter(l => l !== listener);
    }
    public notifyScoreListeners(): void {
        this.scoreListeners.forEach(listener => listener(this.highScore));
    }
}