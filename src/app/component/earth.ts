import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, InjectionToken, input, signal, viewChild } from "@angular/core";
import { beforeRender as _beforeRender, NgtArgs } from "angular-three";
import { textureResource as _textureResource } from "angular-three-soba/loaders";
import * as THREE from "three";
import { Cursor } from "./cursor";

export const BEFORE_RENDER_FN = new InjectionToken('BEFORE_RENDER_FN', {
    providedIn: 'root', factory: () => _beforeRender
});
export const TEXTURE_RESOURCE_FN = new InjectionToken('TEXTURE_RESOURCE_FN', {
    providedIn: 'root', factory: () => _textureResource
});

@Component({
    selector: "app-earth",
    template: `
        <ngt-mesh #earth cursor [position]="[4, 1.5, 0]" name="earth" castShadow receiveShadow>
            <ngt-sphere-geometry *args="[1, 64, 64]" />

            @let _textures = textures.value();
            @let map = _textures?.map;
            @let bumpMap = _textures?.bumpMap;

            <ngt-mesh-standard-material [map]="map" [bumpMap]="bumpMap" />
        </ngt-mesh>
    `,
    imports: [NgtArgs, Cursor],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Earth {
    positionX = input(0);
    private meshRef = viewChild.required<ElementRef<THREE.Mesh>>('earth');
    protected textures = inject(TEXTURE_RESOURCE_FN)(() => ({
        map: "https://raw.githubusercontent.com/nartc/threejs-earth/refs/heads/main/src/assets/Albedo.jpg",
        bumpMap: "https://raw.githubusercontent.com/nartc/threejs-earth/refs/heads/main/src/assets/Bump.jpg",
    }));
    
    protected hovered = signal(false);
    protected clicked = signal(false);

    constructor() {
        const beforeRender = inject(BEFORE_RENDER_FN);
        beforeRender(({ delta }) => {
            let earthRef = this.meshRef()?.nativeElement;
            if (earthRef) {
                earthRef.rotation.y += delta / 5;
            }
        });
    }
}