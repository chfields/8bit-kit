export type LogLevel = "debug" | "warn" | "error" | "silent";
export declare const log: {
    debug: (..._args: unknown[]) => void;
    warn: (..._args: unknown[]) => void;
    error: (..._args: unknown[]) => void;
};
export declare function configureLog(options: {
    defaultLevel: LogLevel;
}): void;
