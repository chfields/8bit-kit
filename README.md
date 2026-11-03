# 8bit-kit

Shared code for 8-bit WebXR arcade games built with BabylonJS, TypeScript and Vite.

Install a pinned tag from GitHub:

```json
"8bit-kit": "github:chfields/8bit-kit#v0.1.0"
```

Use that form. A different package named `8bit-kit` exists on npm, and a plain
`npm install 8bit-kit` would fetch that one.

## Using it

Import each file by its path. There's no single entry point.

```ts
import { VoxelText } from "8bit-kit/effects/VoxelText";
```

The game supplies Babylon, so there is only ever one copy. `@babylonjs/core` and
`@babylonjs/gui` are peer dependencies. Set this in the game's Vite config so that a
linked kit can't load a second copy from its own folder:

```ts
resolve: { dedupe: ["@babylonjs/core", "@babylonjs/gui"] }
```

And set this in the game's `tsconfig.json`, or the type check sees two copies:

```json
"paths": {
  "@babylonjs/core/*": ["./node_modules/@babylonjs/core/*"],
  "@babylonjs/gui/*": ["./node_modules/@babylonjs/gui/*"]
}
```

## Starting a game

Import these first in the game's `main.ts`, then configure the kit once, before anything
creates its objects. Crawler does this in a file called `src/kitSetup.ts`.

```ts
import "8bit-kit/babylon-features";
import { configureLog } from "8bit-kit/game/Logger";
configureLog({ defaultLevel: import.meta.env.DEV ? "debug" : "warn" });
```

Without `configureLog`, the log level is `warn`. Adding `?log=debug` to the URL overrides it.

`GameAssetManager`, `PlayerBullet` and `CoinCabinet` throw an error if they're created before
their `configure` call:

```ts
GameAssetManager.configure({ sounds, meshes });
PlayerBullet.configure({ collisionMask, destroys, onCollision });
CoinCabinet.configure({ sideRows, screenRows, colors, floating });
```

`Hud` takes `{ longestText }` when it's created.

## What a game must provide

This kit is for my own games. It's public so that their builds can install it without a
token, and it isn't supported for other projects.

- **Babylon:** `@babylonjs/core`, `@babylonjs/gui` and `@babylonjs/loaders`.
- **The font:** load "Press Start 2P" before using `assets/Fonts` or `game/UITextMesh`.
- **Masks:** the kit owns the `CollisionGroup` numbers. Each game defines its own masks, and
  16 is free for an extra group.
- **A model** named `Pistol`, for `xr/XRInputController`.
- **Images:** `/assets/images/NightSkybox.png` for `xr/XREnvironment`, and
  `/assets/images/stars.jpg` for `xr/Rift`.
- **Sounds:** `alien-explosion`, `cabinet-build`, `coin-drop`, `laser`, `mothership-explosion`, `portal-rush`, `screen-hum`, `screen-open`.

The kit assumes the wall faces +Z. `game/HighScore` stores under `"highScore"`, which is
separate for each site.

## Working on it

- `npm run build` type checks and compiles `src` to `dist`.
- `npm test` runs the logic tests. Most of the kit is tested through a game's own suite.
- `python3 scripts/generate-smoke.py` redraws the portal's smoke. Needs Pillow and NumPy.
- `npm link` here, then `npm link 8bit-kit` in a game, to use a local copy.
- `scripts/release.sh 0.2.0` builds, commits `dist` and tags. It doesn't push.

While below 1.0, a breaking change raises the middle number and anything else raises the
last. Tags never move, so fix a bad release with a new tag.

MIT licence.
