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
    selector: "app-expendible-dart-drone",
    template: `
        <ngt-primitive
            #expendibleDartDrone
            castShadow
            receiveShadow
			*args="[expendableDartDrone()]"
			[position]="position()"
            [hoverColor]="hoverColor()"
            [color]="color()"
            [clicked]="clicked()"
		/>
    `,
    imports: [NgtArgs],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})

export class ExpendableDartDrone {
    position = input<Triplet>([0, 0, 0]);
    color = input<string>('red');
    hoverColor = input<string>('darkred');

    protected hovered = signal(false);
    protected clicked = signal(false);

    protected models = inject(GLTF_RESOURCE_FN)(() => ({ expendableDartDrone: 'models/expendable_dart_drone_mod.glb' }), {
        onLoad(data) {},
    });

    protected expendableDartDrone = computed(() => {
        const gltf = this.models.asReadonly().value()?.expendableDartDrone;
        if (!gltf) {
            return null;
        }
        return gltf.scene
    });
    
    private meshRef = viewChild.required<ElementRef<THREE.Mesh>>('expendibleDartDrone');
    
    constructor() {
        const beforeRender = inject(BEFORE_RENDER_FN);
        beforeRender(({ delta }) => {
            let expendibleDartDroneRef = this.meshRef()?.nativeElement;
            if (expendibleDartDroneRef) {
                expendibleDartDroneRef.rotation.z += delta / 5;
            }
        });
    }
}