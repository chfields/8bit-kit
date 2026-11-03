import { XRInputController } from "./XRInputController";
type ControllerObserver = (controller: XRInputController) => void;
export declare class XRInputControllers {
    private xrHelper;
    right: XRInputController | null;
    left: XRInputController | null;
    setupCompletObservers: (() => void)[];
    private rightRemovedObservers;
    private leftAddedObservers;
    private leftRemovedObservers;
    constructor(xrHelper: any);
    private motionControllerInitObservable;
    private controllerAddedObservable;
    private controllerRemovedObservable;
    private setupController;
    setupCompleteObserver(observer: () => void): void;
    rightRemovedObserver(observer: ControllerObserver): void;
    leftAddedObserver(observer: ControllerObserver): void;
    leftRemovedObserver(observer: ControllerObserver): void;
    dispose(): void;
}
export {};
