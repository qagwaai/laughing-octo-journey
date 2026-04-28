import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, InjectionToken, input, signal, viewChild } from "@angular/core";
import { beforeRender as _beforeRender, NgtArgs } from "angular-three";
import { textureResource as _textureResource } from "angular-three-soba/loaders";
import * as THREE from "three";
import { Cursor } from "./cursor";
import { Triplet } from '@pmndrs/cannon-worker-api';

export const BEFORE_RENDER_FN = new InjectionToken('BEFORE_RENDER_FN', {
    providedIn: 'root', factory: () => _beforeRender
});
export const TEXTURE_RESOURCE_FN = new InjectionToken('TEXTURE_RESOURCE_FN', {
    providedIn: 'root', factory: () => _textureResource
});

@Component({
    selector: "app-sol",
    template: `
        <ngt-mesh #sol cursor [position]="position()" name="sol">
            <ngt-sphere-geometry *args="[radius(), 64, 64]" />
            <ngt-mesh-basic-material [color]="sunColor()" />
        </ngt-mesh>
    `,
    imports: [NgtArgs, Cursor],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Sol {
    position = input<Triplet>([0, 0, 0]);
    sunColor = input<string>('#f5ff6b');
    radius = input<number>(1);

    private meshRef = viewChild.required<ElementRef<THREE.Mesh>>('sol');
    protected hovered = signal(false);
    protected clicked = signal(false);
    protected textures = inject(TEXTURE_RESOURCE_FN)(() => ({
        sunTexture: "images/sol_surface.png",
        sunColorLookupTexture: "images/sol_colorshift.png",
        solarflareTexture: "images/solarflare.png",
        sunHaloTexture: "images/sun_halo.png",
        sunHaloColorTexture: "images/sol_halo_colorshift.png",
        sunCoronaTexture: "images/sol_corona.png",
    }));

    constructor() {
        const beforeRender = inject(BEFORE_RENDER_FN);
        beforeRender(({ delta }) => {
            const solRef = this.meshRef()?.nativeElement;
            if (solRef) {
                solRef.rotation.y += delta / 5;
            }
        });
        effect(() => {
            const sunTexture = this.textures.asReadonly().value()?.sunTexture;
            if (sunTexture) {
                sunTexture.wrapS = sunTexture.wrapT = THREE.RepeatWrapping;
                const material = this.meshRef()?.nativeElement.material as THREE.MeshBasicMaterial;
                material.map = sunTexture;
                material.needsUpdate = true;
            }
        });
    }
}