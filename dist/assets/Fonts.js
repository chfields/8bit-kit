import FontFaceObserver from "fontfaceobserver";
const DefaultGameFont = "Press Start 2P";
const waitForGameFont = () => {
    return new FontFaceObserver(DefaultGameFont)
        .load();
};
export { DefaultGameFont, waitForGameFont };
