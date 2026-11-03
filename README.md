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

Set the default log level once, at the top of the game's `main.ts`. Without this call the
level is `warn`. Adding `?log=debug` to the URL overrides it.

```ts
import { configureLog } from "8bit-kit/game/Logger";
configureLog({ defaultLevel: import.meta.env.DEV ? "debug" : "warn" });
```

## What a game must provide

This kit is for my own games. It's public so that their builds can install it without a
token, and it isn't supported for other projects.

- **Babylon features.** Babylon only switches on some features when their module is
  imported. Keep these in the game's `main.ts`, because the kit doesn't import them:
  - `@babylonjs/core/Layers/effectLayerSceneComponent` and
    `@babylonjs/core/Particles/particleSystemComponent` for `xr/Portal`
  - `@babylonjs/core/Culling/ray` for `screen/VoxelButton` and `screen/ErrorScreenXR`
- **The font.** Load "Press Start 2P" before using `assets/Fonts` or `game/UITextMesh`.
- **Masks.** The kit owns the `CollisionGroup` numbers. Each game defines its own masks, and
  16 is free for an extra group.
- **Network.** `xr/Portal` downloads its smoke from Babylon's snippet server when it opens.

The kit assumes the wall faces +Z. `game/HighScore` stores under `"highScore"`, which is
separate for each site.

## Working on it

- `npm run build` type checks and compiles `src` to `dist`.
- `npm link` here, then `npm link 8bit-kit` in a game, to use a local copy.
- `scripts/release.sh 0.2.0` builds, commits `dist` and tags. It doesn't push.

While below 1.0, a breaking change raises the middle number and anything else raises the
last. Tags never move, so fix a bad release with a new tag.

MIT licence.
