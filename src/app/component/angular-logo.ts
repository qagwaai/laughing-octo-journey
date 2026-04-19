import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, InjectionToken, input, signal, viewChild } from "@angular/core";
import { Triplet } from "@pmndrs/cannon-worker-api/dist/types";
import { beforeRender as _beforeRender, NgtArgs } from "angular-three";
import { gltfResource as _gltfResource } from "angular-three-soba/loaders";
import * as THREE from "three";

export const BEFORE_RENDER_FN = new InjectionToken('BEFORE_RENDER_FN', {
    providedIn: 'root', factory: () => _beforeRender
});
export const GLTF_RESOURCE_FN = new InjectionToken('GLTF_RESOURCE_FN', {
    providedIn: 'root', factory: () => _gltfResource
});

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

    protected models = inject(GLTF_RESOURCE_FN)(() => ({ angularLogo: 'models/aLogo.glb' }), {
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
        const beforeRender = inject(BEFORE_RENDER_FN);
        beforeRender(({ delta }) => {
            let angularLogoRef = this.meshRef()?.nativeElement;
            if (angularLogoRef) {
                angularLogoRef.rotation.y += delta / 5;
            }
        });
    }
}