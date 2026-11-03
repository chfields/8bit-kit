// Features Babylon only switches on when their module is imported. Without these a game
// can fail silently, for example bullets passing through everything. Import this first
// from the game's main.ts.
import "@babylonjs/core/Animations/animatable.js"; // enables scene.beginAnimation
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/core/Culling/ray"; // picking
import "@babylonjs/core/Helpers/sceneHelpers"; // createDefaultXRExperienceAsync
import "@babylonjs/core/Layers/effectLayerSceneComponent"; // glow
import "@babylonjs/core/Particles/particleSystemComponent";
import "@babylonjs/core/XR/index"; // XR features and controller profiles
// XR hand tracking and near interaction build node materials from these blocks.
// Without them the console fills with "Build of NodeMaterial failed".
import "@babylonjs/core/Materials/Node/Blocks";
// The GLB loader for the game's models.
import "@babylonjs/loaders/glTF/glTFFileLoader";
import "@babylonjs/loaders/glTF/2.0/index";
