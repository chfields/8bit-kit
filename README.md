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

## Test Room

An optional step where the player chooses the wall by facing it. Add
`TEST_ROOM_BUTTON_TYPES` to `PlayerBullet.configure`'s `destroys`, add a button to the
start screen, and have it call:

    await xrEnvironment.enterVR({ chooseWall: true });
    const testRoom = new TestRoom({ xrEnvironment, scene, getAimRay, onStart, onBack });

`onStart` runs just before the wall locks, so it must leave the game ready for the size
observers to start its opening. Call `testRoom.dispose()` when the session ends. It's safe
to call more than once. The pistol must be able to fire before a stage exists.

A game with no pistol can skip both `TEST_ROOM_BUTTON_TYPES` and that last rule. It listens to
the trigger itself, and on a pull calls:

    testRoom.pressAimed();

That presses the button `getAimRay`'s ray is on, and returns whether it pressed one. It does
nothing once the room is finishing or disposed. `testRoom.aimedDistance()` gives the distance
to that button, or null, so an aim line can end there.

With `?gaps` in the URL, in any build, or `showGaps: true` in the options, the Test Room also
checks for gaps. Once a wall is faced, PICK holds it, so the player can turn round without the choice moving,
and CHANGE lets it go again. While a wall is picked, the room is shown as it will be in play,
with red wherever space would show through. A game can do the same with
`xrEnvironment.previewGaps(wall)` and `xrEnvironment.endGapPreview()`.

RESCAN SPACE, at the top left of the faced wall, opens the headset's own room setup through
`xrEnvironment.rescanRoom()`, which resolves to whether it started. Afterwards the player picks
again. If the headset refuses, the Test Room says so.

Standing where the headset has no floor, the Test Room says the room isn't scanned and offers
only RESCAN SPACE and BACK. Start Game opens the room setup instead. A wall end that meets no
other wall means the scan is missing one, and the Test Room warns about it.

## Room surfaces

`xr/XREnvironment` follows the headset's room data for the whole session. A surface the
headset removes goes, one it moves follows, and one whose outline changes is built again.
The headset replaces every surface each time a session starts. It reports every room it has scanned, so
the player's room is the floor under their head. Only that room's walls can be chosen, and only
its surfaces and furniture are used for rifts, flight paths and the floor height. Other rooms'
surfaces still hide the stars. `xrEnvironment.playerRoomState()` says whether the player is in
a scanned room. The portal's wall never
changes once it's found, and a later report of that same wall is ignored.

Surfaces further back than the portal wall, such as an alcove or the next room, are removed,
and an invisible panel in line with the portal wall covers the gap they leave beside it. So is
another room's surface that reaches past the portal wall, such as a neighbour's floor or ceiling
that starts beside the player's room: seen through the portal, it would hide the stars. The
player's own floor and ceiling stay, however far their scans run past the wall. The Test Room's
PICK preview follows the same rule.

Walls to the left, right and behind the player stretch 8 cm past their ends, which closes the
cracks where two surfaces only just meet. Nothing stretches across the portal wall's plane.
`?overlap=` in the URL sets the stretch in cm, in any build: `0` turns it off, and a value
that isn't a number from 0 to 50 means the default.

## Pressing a button without a bullet

`VoxelButton.press()` does what a bullet hit does: `onShot` fires once, however the button gets
pressed. It returns whether it pressed the button, and does nothing if the button is disabled,
disposed, has burst or has already been pressed. `isAimedAt()` says whether `getAimRay`'s ray
is on the button, and `aimedDistance()` says how far along the ray it is, or null.

## Aim line

A thin glowing line along a controller's aim, for games and screens with no pistol. The kit
leaves Babylon's own laser pointer off.

    const aimLine = new AimLine({ scene, getAimRay, color, length }); // The last two are optional.
    aimLine.setTarget(testRoom.aimedDistance(), color);
    aimLine.dispose();

It follows `getAimRay` every frame, and hides when the ray is null. With no target it runs its
length, 2 m by default, and fades out. With a target it stops at that distance, solid, in the
colour given, or yellow if there's none. Call `setTarget` each frame if the target can change.

Nothing can pick it or hit it, so it doesn't block bullets or button rays. Like the kit's text,
it draws in rendering group 1, so it shows in front of the room's surfaces and is hidden behind
them. That relies on the depth rule below. A game owns one per hand if it wants both, and
disposes them when it's finished.

## Hold to exit

Holding X on the left controller for 2 seconds leaves the session, with a bar showing the
time left. A game creates one when XR starts, and disposes it when XR ends:

    const holdToExit = new HoldToExit({ xrEnvironment, scene, onExit });

`onExit` should exit XR. A game should tell players about it, and shouldn't use X for
anything else.

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

The portal's edges draw in rendering group 1, so the game must not clear depth between groups:

```ts
scene.setRenderingAutoClearDepthStencil(1, false, false, false);
```

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
