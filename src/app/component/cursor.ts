import { Directive, DOCUMENT, ElementRef, inject, InjectionToken } from "@angular/core";
import { objectEvents as _objectEvents } from "angular-three";
import * as THREE from "three";

export const OBJECT_EVENTS_FN = new InjectionToken('OBJECT_EVENTS_FN', {
    providedIn: 'root', factory: () => _objectEvents
});

@Directive({

    selector: "ngt-mesh[cursor]"
})
export class Cursor {
    constructor() {

        const document = inject(DOCUMENT);
        const elementRef = inject<ElementRef<THREE.Mesh>>(ElementRef);
        const objectEvents = inject(OBJECT_EVENTS_FN);
        const nativeElement = elementRef.nativeElement;

        if (nativeElement.isMesh) {

            objectEvents(() => nativeElement, {
                pointerover: () => {
                    document.body.style.cursor = "pointer";
                },
                pointerout: () => {
                    document.body.style.cursor = "default";
                },
            });
        }
    }
}