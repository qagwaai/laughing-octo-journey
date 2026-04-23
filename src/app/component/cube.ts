import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, InjectionToken, input, signal, viewChild } from "@angular/core";
import { beforeRender as _beforeRender, NgtArgs } from "angular-three";
import * as THREE from "three";

/**
 * Injection token wrapping angular-three's beforeRender so it can be replaced
 * in unit tests without Jest's module-mocking infrastructure.
 */
export const BEFORE_RENDER_FN = new InjectionToken<typeof _beforeRender>(
    'BEFORE_RENDER_FN',
    { providedIn: 'root', factory: () => _beforeRender }
);

@Component({
    selector: "app-cube",
    template: `
        <ngt-mesh #mesh name="cube"
            
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
        const beforeRender = inject(BEFORE_RENDER_FN);
        beforeRender(({ delta }) => {
            this.meshRef().nativeElement.rotation.y += delta;
        });
    }
}