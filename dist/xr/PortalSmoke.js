import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { PORTAL_SMOKE_TEXTURE } from "./portalSmokeTexture";
// How the smoke behaves. The image is the kit's own, from scripts/generate-smoke.py.
const SETTINGS = {
    "capacity": 10000,
    "disposeOnStop": false,
    "manualEmitCount": -1,
    "isLocal": false,
    "animations": [],
    "beginAnimationOnStart": false,
    "beginAnimationFrom": 0,
    "beginAnimationTo": 60,
    "beginAnimationLoop": false,
    "startDelay": 0,
    "renderingGroupId": 0,
    "isBillboardBased": true,
    "billboardMode": 7,
    "minAngularSpeed": 1,
    "maxAngularSpeed": 2,
    "minSize": 0.125,
    "maxSize": 0.5,
    "minScaleX": 1,
    "maxScaleX": 1,
    "minScaleY": 1,
    "maxScaleY": 1,
    "minEmitPower": 0,
    "maxEmitPower": 0,
    "minLifeTime": 0.3,
    "maxLifeTime": 0.5,
    "emitRate": 400,
    "gravity": [
        0,
        0,
        0
    ],
    "noiseStrength": [
        10,
        10,
        10
    ],
    "color1": [
        1,
        1,
        1,
        1
    ],
    "color2": [
        1,
        1,
        1,
        1
    ],
    "colorDead": [
        1,
        1,
        1,
        0
    ],
    "updateSpeed": 0.002,
    "targetStopDuration": 0,
    "blendMode": 2,
    "preWarmCycles": 0,
    "preWarmStepOffset": 1,
    "minInitialRotation": 0,
    "maxInitialRotation": 360,
    "startSpriteCellID": 0,
    "spriteCellLoop": true,
    "endSpriteCellID": 0,
    "spriteCellChangeSpeed": 1,
    "spriteCellWidth": 0,
    "spriteCellHeight": 0,
    "spriteRandomStartCell": false,
    "isAnimationSheetEnabled": false,
    "useLogarithmicDepth": false,
    "colorGradients": [
        {
            "gradient": 0,
            "color1": [
                0.12941176470588237,
                0.9686274509803922,
                0.9411764705882353,
                0.09803921568627451
            ],
            "color2": [
                0.09411764705882353,
                0.5137254901960784,
                0.984313725490196,
                0.09803921568627451
            ]
        },
        {
            "gradient": 1,
            "color1": [
                0.17647058823529413,
                0.07058823529411765,
                0.9882352941176471,
                0.09803921568627451
            ],
            "color2": [
                0,
                0.9019607843137255,
                1,
                0.09803921568627451
            ]
        }
    ],
    "sizeGradients": [
        {
            "gradient": 0.07,
            "factor1": 0,
            "factor2": 0
        },
        {
            "gradient": 0.33,
            "factor1": 0.3,
            "factor2": 0.125
        },
        {
            "gradient": 0.76,
            "factor1": 0.5,
            "factor2": 0.5
        }
    ],
    "textureMask": [
        1,
        1,
        1,
        1
    ],
    "customShader": null,
    "preventAutoStart": false
};
const TEXTURE = {
    "uScale": 1,
    "vScale": 1,
    "isBlocking": true,
    "hasAlpha": false,
    "level": 1,
    "coordinatesMode": 0,
    "wrapU": 1,
    "wrapV": 1,
    "invertY": true,
    "samplingMode": 3
};
// The caller sets the emitter.
export function createPortalSmoke(scene) {
    return ParticleSystem.Parse({
        ...SETTINGS,
        name: "portalSmoke",
        // Parse needs an emitter here. Portal replaces it with its own.
        particleEmitterType: {
            type: "BoxParticleEmitter",
            direction1: [-1, -1, -1],
            direction2: [1, 1, 1],
            minEmitBox: [0, 0, 0],
            maxEmitBox: [0, 0, 0],
        },
        id: "portalSmoke",
        texture: { ...TEXTURE, name: "portalSmoke", url: PORTAL_SMOKE_TEXTURE },
    }, scene, "");
}
