import { XRInputController } from "./XRInputController";
import { log } from "../game/Logger";
export class XRInputControllers {
    constructor(xrHelper) {
        Object.defineProperty(this, "xrHelper", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "right", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "left", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "setupCompletObservers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "rightRemovedObservers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "leftAddedObservers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "leftRemovedObservers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.xrHelper = xrHelper;
        this.setupController();
    }
    motionControllerInitObservable(motionController, inputSource) {
        // change text when trigger is pressed
        inputSource.pointer.setEnabled(false);
        if (motionController.handness === "right") {
            this.right?.dispose();
            this.right = new XRInputController(motionController, inputSource, "right");
            this.setupCompletObservers.forEach((observer) => observer());
        }
        else {
            this.left?.dispose();
            const left = new XRInputController(motionController, inputSource, "left");
            this.left = left;
            this.leftAddedObservers.forEach((observer) => observer(left));
        }
    }
    controllerAddedObservable(inputSource) {
        inputSource.onMotionControllerInitObservable.add((motionController) => {
            this.motionControllerInitObservable(motionController, inputSource);
        });
    }
    controllerRemovedObservable(inputSource) {
        log.debug("Controller removed", inputSource.inputSource.handedness);
        if (this.right?.isForInputSource(inputSource)) {
            const removed = this.right;
            this.right = null;
            this.rightRemovedObservers.forEach((observer) => observer(removed));
            removed.dispose();
        }
        else if (this.left?.isForInputSource(inputSource)) {
            const removed = this.left;
            this.left = null;
            this.leftRemovedObservers.forEach((observer) => observer(removed));
            removed.dispose();
        }
    }
    setupController() {
        this.xrHelper.input.onControllerAddedObservable.add(this.controllerAddedObservable.bind(this));
        this.xrHelper.input.onControllerRemovedObservable.add(this.controllerRemovedObservable.bind(this));
    }
    setupCompleteObserver(observer) {
        this.setupCompletObservers.push(observer);
    }
    rightRemovedObserver(observer) {
        this.rightRemovedObservers.push(observer);
    }
    leftAddedObserver(observer) {
        this.leftAddedObservers.push(observer);
    }
    leftRemovedObserver(observer) {
        this.leftRemovedObservers.push(observer);
    }
    dispose() {
        if (this.right) {
            this.right.dispose();
        }
        if (this.left) {
            this.left.dispose();
        }
    }
}
