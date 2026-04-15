import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, ElementRef, input, signal, viewChild } from "@angular/core";
import { Triplet } from "@pmndrs/cannon-worker-api/dist/types";
import { beforeRender, NgtArgs } from "angular-three";
import { gltfResource } from "angular-three-soba/loaders";
import * as THREE from "three";

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

    protected models = gltfResource(() => ({ expendableDartDrone: 'models/expendable_dart_drone_mod.glb' }), {
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
        beforeRender(({ delta }) => {
            let expendibleDartDroneRef = this.meshRef()?.nativeElement;
            if (expendibleDartDroneRef) {
                expendibleDartDroneRef.rotation.z += delta / 5;
            }
        });
    }
}