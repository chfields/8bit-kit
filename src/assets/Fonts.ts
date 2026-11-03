import FontFaceObserver from "fontfaceobserver";
const DefaultGameFont = "Press Start 2P";

const waitForGameFont = () : Promise<void> => {
    return new FontFaceObserver(DefaultGameFont)
        .load();
}

export { DefaultGameFont, waitForGameFont };