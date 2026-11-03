import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { WebXRAbstractMotionController } from "@babylonjs/core/XR/motionController/webXRAbstractMotionController";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllerComponent";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { Nullable } from "@babylonjs/core/types";
import { GameAssetManager } from "../assets/GameAssetManager";
import { log } from "../game/Logger";

// Hand-tuned so the model sits in the hand and lines up with the pointer ray.
const MODEL_YAW_OFFSET = Math.PI * -0.042;
const MODEL_Y_OFFSET = -0.023;

// WebXR's standard layout puts a controller's first face button here: A on a Quest
// controller. Other makers' controllers use the same slot for their equivalent.
const PRIMARY_BUTTON_INDEX = 4;

export class XRInputController {
  private motionController: WebXRAbstractMotionController;
  private inputSource: WebXRInputSource;
  private handness: string;
  private trigger: Nullable<WebXRControllerComponent> = null;
  private buttons: Nullable<WebXRControllerComponent[]> = null;
  private triggerObservers: ((
    trigger: WebXRControllerComponent,
    inputSource: WebXRInputSource
  ) => void)[] = [];
  private buttonObservers: ((
    button: WebXRControllerComponent,
    inputSource: WebXRInputSource
  ) => void)[] = [];
  private controllerMesh: Nullable<AbstractMesh> = null;

  constructor(
    motionController: WebXRAbstractMotionController,
    inputSource: WebXRInputSource,
    handness: string
  ) {
    this.motionController = motionController;
    this.inputSource = inputSource;
    this.handness = handness;
    this.setupTrigger();
    log.debug("Controller created", this.handness);
  }

  public showModel() {
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

  public hideModel() {
    this.controllerMesh?.dispose();
    this.controllerMesh = null;
  }

  public isForInputSource(inputSource: WebXRInputSource): boolean {
    return this.inputSource === inputSource;
  }

  private triggerStateChanged(component: any) {
    this.triggerObservers.forEach((observer) =>
      observer(component, this.inputSource)
    );
  }

  private buttonStateChanged(component: any) {
    this.buttonObservers.forEach((observer) =>
      observer(component, this.inputSource)
    );
  }

  private setupTrigger() {
    this.trigger = this.motionController.getComponentOfType("trigger");

    if (this.trigger) {
      this.trigger.onButtonStateChangedObservable.add(
        this.triggerStateChanged.bind(this)
      );
    }

    const buttons = this.motionController.getAllComponentsOfType("button");
    if (buttons) {
      buttons?.forEach((button) => {
        button.onButtonStateChangedObservable.add(
          this.buttonStateChanged.bind(this)
        );
      });
      this.buttons = buttons;
    }
  }

  public isPrimaryButtonPressed(): boolean {
    return (
      this.inputSource.inputSource.gamepad?.buttons[PRIMARY_BUTTON_INDEX]?.pressed ?? false
    );
  }

  public getPosition(): Vector3 {
    const node = this.inputSource.grip ?? this.inputSource.pointer;
    return node.getAbsolutePosition().clone();
  }

  public getAimRay(): Ray {
    const ray = Ray.Zero();
    this.inputSource.getWorldPointerRayToRef(ray, false);
    return ray;
  }

  public getMesh(): AbstractMesh | undefined {
    return this.inputSource.grip;
  }

  public addTriggerObserver(
    observer: (
      trigger: WebXRControllerComponent,
      inputSource: WebXRInputSource
    ) => void
  ) {
    this.triggerObservers.push(observer);
  }

  public addButtonObserver(
    observer: (
      button: WebXRControllerComponent,
      inputSource: WebXRInputSource
    ) => void
  ) {
    this.buttonObservers.push(observer);
  }

  public dispose() {
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
