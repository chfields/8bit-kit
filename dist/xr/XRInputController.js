import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { GameAssetManager } from "../assets/GameAssetManager";
import { log } from "../game/Logger";
// Hand-tuned so the model sits in the hand and lines up with the pointer ray.
const MODEL_YAW_OFFSET = Math.PI * -0.042;
const MODEL_Y_OFFSET = -0.023;
// WebXR's standard layout puts a controller's first face button here: A on a Quest
// controller. Other makers' controllers use the same slot for their equivalent.
const PRIMARY_BUTTON_INDEX = 4;
export class XRInputController {
    constructor(motionController, inputSource, handness) {
        Object.defineProperty(this, "motionController", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "inputSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "handness", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "trigger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "buttons", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "triggerObservers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "buttonObservers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "controllerMesh", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.motionController = motionController;
        this.inputSource = inputSource;
        this.handness = handness;
        this.setupTrigger();
        log.debug("Controller created", this.handness);
    }
    showModel() {
        if (this.controllerMesh) {
            return;
        }
        const grip = this.inputSource.grip;
        if (!grip) {
            // Input sources such as hands may not have a grip to hold the model.
            log.warn("No grip found for input source");
            return;
        }
        const mesh = GameAssetManager.existingInstance().clone("Pistol", "Pistol");
        mesh.parent = grip;
        mesh.rotate(new Vector3(0, 1, 0), MODEL_YAW_OFFSET);
        mesh.position.y += MODEL_Y_OFFSET;
        this.controllerMesh = mesh;
    }
    hideModel() {
        this.controllerMesh?.dispose();
        this.controllerMesh = null;
    }
    isForInputSource(inputSource) {
        return this.inputSource === inputSource;
    }
    triggerStateChanged(component) {
        this.triggerObservers.forEach((observer) => observer(component, this.inputSource));
    }
    buttonStateChanged(component) {
        this.buttonObservers.forEach((observer) => observer(component, this.inputSource));
    }
    setupTrigger() {
        this.trigger = this.motionController.getComponentOfType("trigger");
        if (this.trigger) {
            this.trigger.onButtonStateChangedObservable.add(this.triggerStateChanged.bind(this));
        }
        const buttons = this.motionController.getAllComponentsOfType("button");
        if (buttons) {
            buttons?.forEach((button) => {
                button.onButtonStateChangedObservable.add(this.buttonStateChanged.bind(this));
            });
            this.buttons = buttons;
        }
    }
    isPrimaryButtonPressed() {
        return (this.inputSource.inputSource.gamepad?.buttons[PRIMARY_BUTTON_INDEX]?.pressed ?? false);
    }
    getPosition() {
        const node = this.inputSource.grip ?? this.inputSource.pointer;
        return node.getAbsolutePosition().clone();
    }
    getAimRay() {
        const ray = Ray.Zero();
        this.inputSource.getWorldPointerRayToRef(ray, false);
        return ray;
    }
    getMesh() {
        return this.inputSource.grip;
    }
    addTriggerObserver(observer) {
        this.triggerObservers.push(observer);
    }
    addButtonObserver(observer) {
        this.buttonObservers.push(observer);
    }
    dispose() {
        if (this.trigger) {
            this.trigger.onButtonStateChangedObservable.clear();
        }
        this.triggerObservers = [];
        if (this.buttons) {
            this.buttons.forEach((button) => {
                button.onButtonStateChangedObservable.clear();
            });
        }
        this.buttonObservers = [];
        this.hideModel();
    }
}
