
import { Directive, DOCUMENT, ElementRef, inject } from "@angular/core";
import { objectEvents } from "angular-three";
import * as THREE from "three";

@Directive({

    selector: "ngt-mesh[cursor]"
})
export class Cursor {
    constructor() {

        const document = inject(DOCUMENT);
        const elementRef = inject<ElementRef<THREE.Mesh>>(ElementRef);
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