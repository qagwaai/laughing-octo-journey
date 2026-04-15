import { AfterContentInit, Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, input, signal, viewChild } from "@angular/core";
import { beforeRender, NgtArgs } from "angular-three";
import { textureResource } from "angular-three-soba/loaders";
import * as THREE from "three";
import { Cursor } from "./cursor";
import { Triplet } from '@pmndrs/cannon-worker-api';
import { max } from "rxjs";
import { NgtpEffectComposer, NgtpGodRays } from 'angular-three-postprocessing';

@Component({
    selector: "app-sol",
    template: `
        <ngt-mesh #sol cursor [position]="position()" name="sol" castShadow receiveShadow>
            <ngt-sphere-geometry *args="[1, 64, 64]" />
            <ngt-mesh-basic-material color="#f5ff6b" [metalness]="0.5" [roughness]="0.3" />
        </ngt-mesh>
        <ngtp-effect-composer>
            <ngtp-god-rays
                [options]="{
                    sun: meshRef().nativeElement,
                    density: 0.97,
                    decay: 0.94,
                    weight: 0.6,
                    exposure: 0.55,
                    samples: 60,
                    blur: true,
                }"
            />
        </ngtp-effect-composer>
    `,
    imports: [NgtArgs, Cursor, NgtpEffectComposer, NgtpGodRays],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Sol {
    position = input<Triplet>([0, 0, 0]);
    
    protected meshRef = viewChild.required<ElementRef<THREE.Mesh>>('sol');
    protected textures = textureResource(() => ({
        sunTexture: "images/sol_surface.png",
        sunColorLookupTexture: "images/sol_colorshift.png",
        solarflareTexture: "images/solarflare.png",
        sunHaloTexture: "images/sun_halo.png",
        sunHaloColorTexture: "images/sol_halo_colorshift.png",
        sunCoronaTexture: "images/sol_corona.png",
    }));
    
    protected hovered = signal(false);
    protected clicked = signal(false);

    constructor() {
        beforeRender(({ delta }) => {
            let solRef = this.meshRef()?.nativeElement;
            if (solRef) {
                solRef.rotation.y += delta / 5;
            }
        });
        effect(() => {
            console.log("Sol component initialized, textures loaded:", this.textures.asReadonly().value());
            const sunTexture = this.textures.asReadonly().value()?.sunTexture;  
            if (sunTexture) {
                sunTexture.wrapS = sunTexture.wrapT = THREE.RepeatWrapping;
                const material = this.meshRef()?.nativeElement.material as THREE.MeshStandardMaterial;
                material.map = sunTexture;
                material.needsUpdate = true;
            }   
        });
    }
}