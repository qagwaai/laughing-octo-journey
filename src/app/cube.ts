import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, viewChild, signal, input } from "@angular/core";
import { NgtArgs, beforeRender } from "angular-three";
import * as THREE from "three";

@Component({
    selector: "app-cube",
    template: `
        <ngt-mesh #mesh 
            [position]="[positionX(), 1, 0]"
            [scale]="clicked() ? 1.5 : 1"
            (pointerover)="hovered.set(true)"
            (pointerout)="hovered.set(false)"
            (click)="clicked.set(!clicked())"
            input
            castShadow
        >
            <ngt-box-geometry *args="[1, 2, 1]" />
            <ngt-mesh-standard-material [color]="hovered() ? 'purple' : 'mediumpurple'" />
        </ngt-mesh>
    `,
    imports: [NgtArgs],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Cube {
    positionX = input(0);
    private meshRef = viewChild.required<ElementRef<THREE.Mesh>>('mesh');

    protected hovered = signal(false);
    protected clicked = signal(false);

    constructor() {
        beforeRender(({ delta }) => {
            this.meshRef().nativeElement.rotation.y += delta;
        });
    }
}