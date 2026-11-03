export class HighScore {
    constructor() {
        Object.defineProperty(this, "highScore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scoreListeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.highScore = 0;
        this.loadHighScore();
    }
    loadHighScore() {
        const storedScore = localStorage.getItem("highScore");
        if (storedScore) {
            this.highScore = parseInt(storedScore, 10);
        }
        else {
            this.highScore = 0;
        }
    }
    async saveHighScore() {
        localStorage.setItem("highScore", this.highScore.toString());
    }
    static getInstance() {
        if (!HighScore.instance) {
            HighScore.instance = new HighScore();
        }
        return HighScore.instance;
    }
    getHighScore() {
        return this.highScore;
    }
    checkAndUpdateHighScore(newScore) {
        if (newScore > this.highScore) {
            this.highScore = newScore;
            this.saveHighScore();
            this.notifyScoreListeners();
        }
    }
    addScoreListener(listener) {
        this.scoreListeners.push(listener);
    }
    removeScoreListener(listener) {
        this.scoreListeners = this.scoreListeners.filter(l => l !== listener);
    }
    notifyScoreListeners() {
        this.scoreListeners.forEach(listener => listener(this.highScore));
    }
}
