import { WebXRAbstractMotionController } from "@babylonjs/core/XR/motionController/webXRAbstractMotionController";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { XRInputController } from "./XRInputController";
import { log } from "../game/Logger";

type ControllerObserver = (controller: XRInputController) => void;

export class XRInputControllers {
  private xrHelper: any;

  public right: XRInputController | null = null;
  public left: XRInputController | null = null;
  public setupCompletObservers: (() => void)[] = [];
  private rightRemovedObservers: ControllerObserver[] = [];
  private leftAddedObservers: ControllerObserver[] = [];
  private leftRemovedObservers: ControllerObserver[] = [];

  constructor(xrHelper: any) {
    this.xrHelper = xrHelper;
    this.setupController();
  }

  private motionControllerInitObservable(
    motionController: WebXRAbstractMotionController,
    inputSource: WebXRInputSource
  ) {
    // change text when trigger is pressed
    inputSource.pointer.setEnabled(false);
    if (motionController.handness === "right") {
      this.right?.dispose();
      this.right = new XRInputController(motionController, inputSource, "right");
      this.setupCompletObservers.forEach((observer) => observer());
    } else {
      this.left?.dispose();
      const left = new XRInputController(motionController, inputSource, "left");
      this.left = left;
      this.leftAddedObservers.forEach((observer) => observer(left));
    }
  }

  private controllerAddedObservable(inputSource: WebXRInputSource) {
    inputSource.onMotionControllerInitObservable.add(
      (motionController: WebXRAbstractMotionController) => {
        this.motionControllerInitObservable(motionController, inputSource);
      }
    );
  }

  private controllerRemovedObservable(inputSource: WebXRInputSource) {
    log.debug("Controller removed", inputSource.inputSource.handedness);
    if (this.right?.isForInputSource(inputSource)) {
      const removed = this.right;
      this.right = null;
      this.rightRemovedObservers.forEach((observer) => observer(removed));
      removed.dispose();
    } else if (this.left?.isForInputSource(inputSource)) {
      const removed = this.left;
      this.left = null;
      this.leftRemovedObservers.forEach((observer) => observer(removed));
      removed.dispose();
    }
  }

  private setupController() {
    this.xrHelper.input.onControllerAddedObservable.add(
      this.controllerAddedObservable.bind(this)
    );
    this.xrHelper.input.onControllerRemovedObservable.add(
      this.controllerRemovedObservable.bind(this)
    );
  }

  public setupCompleteObserver(observer: () => void) {
    this.setupCompletObservers.push(observer);
  }

  public rightRemovedObserver(observer: ControllerObserver) {
    this.rightRemovedObservers.push(observer);
  }

  public leftAddedObserver(observer: ControllerObserver) {
    this.leftAddedObservers.push(observer);
  }

  public leftRemovedObserver(observer: ControllerObserver) {
    this.leftRemovedObservers.push(observer);
  }

  public dispose() {
    if (this.right) {
      this.right.dispose();
    }

    if (this.left) {
      this.left.dispose();
    }
  }
}
