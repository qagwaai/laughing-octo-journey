import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core'
import { extend, loaderResource, NgtArgs } from 'angular-three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh, PointLight, SphereGeometry, type Object3D } from 'three'
import * as THREE from 'three';
extend({ Mesh, SphereGeometry, PointLight })

@Component({
	standalone: true,
	template: `
		<!-- angular logo model -->
		<ngt-primitive
			*args="[model()]"
			[position]="[0, 13, -100]"
			(beforeRender)="onBeforeRender($any($event).object)"
		/>

		<!-- particle light -->
		<ngt-mesh
			[position]="[0, 0, -90]"
			(beforeRender)="onParticleLightBeforeRender($any($event).object)"
		>
			<ngt-sphere-geometry *args="[0.05, 8, 8]" />
			<ngt-point-light [intensity]="30" [rotation]="[-Math.PI / 2, 0, 0]" />
		</ngt-mesh>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [NgtArgs],
})
export class LoadingScene {
	protected Math = Math

    constructor() {
        console.log("LoadingScene initialized");
        var model = loaderResource(
            () => GLTFLoader,
            () => 'models/aLogo.glb',
            {
                onProgress: (event) => {
                    console.log(`Loading: ${event.loaded / event.total * 100}%`);
                },
                onLoad: (data) => {
                    console.log('Model loaded:', data);
                },
            }
        );
    }  

	onBeforeRender(object: Object3D) {
		object.rotation.y += 0.01
	}

	onParticleLightBeforeRender(object: Mesh) {
		const timer = Date.now() * 0.00025
		object.position.x = Math.sin(timer * 7) * 3
		object.position.y = Math.cos(timer * 5) * 4
		object.position.z = Math.cos(timer * 3) * 3
	}
}