import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA
} from '@angular/core';
import { extend, NgtArgs } from 'angular-three';
import { gltfResource } from 'angular-three-soba/loaders';
import { Mesh, PointLight, SphereGeometry, type Object3D } from 'three';
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
	protected model = gltfResource(() => ({ alogo: 'models/aLogo.glb' }), {
		onLoad(data) {
			console.log("GLTF model loaded successfully", data);
		},
	});
    constructor() { }  

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