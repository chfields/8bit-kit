const LEVELS = ["debug", "warn", "error", "silent"];
const noop = (..._args) => { };
// The URL wins, so ?log=debug can diagnose a problem on a headset.
function requestedLevel() {
    const requested = new URLSearchParams(window.location.search).get("log");
    return requested && LEVELS.includes(requested)
        ? requested
        : null;
}
// These are bound rather than wrapped so the console shows the file and line of
// the caller. Debug uses console.log because Chrome hides console.debug by default.
export const log = {
    debug: noop,
    warn: noop,
    error: noop,
};
function applyLevel(level) {
    const threshold = LEVELS.indexOf(level);
    const shows = (candidate) => LEVELS.indexOf(candidate) >= threshold;
    log.debug = shows("debug") ? console.log.bind(console, "[debug]") : noop;
    log.warn = shows("warn") ? console.warn.bind(console) : noop;
    log.error = shows("error") ? console.error.bind(console) : noop;
}
// Call once at startup. Callers look up log.debug and the others when they run, so
// they pick up the new level. The kit can't read import.meta.env itself, because only
// Vite fills that in, so each game passes its own default.
export function configureLog(options) {
    applyLevel(requestedLevel() ?? options.defaultLevel);
}
applyLevel(requestedLevel() ?? "warn");
