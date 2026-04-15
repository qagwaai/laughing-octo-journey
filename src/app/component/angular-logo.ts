import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, ElementRef, input, signal, viewChild } from "@angular/core";
import { Triplet } from "@pmndrs/cannon-worker-api/dist/types";
import { beforeRender, NgtArgs } from "angular-three";
import { gltfResource } from "angular-three-soba/loaders";
import * as THREE from "three";

@Component({
    selector: "app-angular-logo",
    template: `
        <ngt-primitive
            #angularLogo
            castShadow
            receiveShadow
			*args="[angularLogo()]"
			[position]="position()"
            [hoverColor]="hoverColor()"
            [color]="color()"
            [clicked]="clicked()"
		/>
    `,
    imports: [NgtArgs],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})

export class AngularLogo {
    position = input<Triplet>([0, 0, 0]);
    color = input<string>('red');
    hoverColor = input<string>('darkred');

    protected hovered = signal(false);
    protected clicked = signal(false);

    protected models = gltfResource(() => ({ angularLogo: 'models/aLogo.glb' }), {
        onLoad(data) {},
    });

    protected angularLogo = computed(() => {
        const gltf = this.models.asReadonly().value()?.angularLogo;
        if (!gltf) {
            return null;
        }
        return gltf.scene
    });
    
    private meshRef = viewChild.required<ElementRef<THREE.Mesh>>('angularLogo');
    
    constructor() {
        beforeRender(({ delta }) => {
            let angularLogoRef = this.meshRef()?.nativeElement;
            if (angularLogoRef) {
                angularLogoRef.rotation.y += delta / 5;
            }
        });
    }
}