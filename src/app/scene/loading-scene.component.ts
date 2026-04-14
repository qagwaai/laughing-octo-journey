import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	ElementRef,
	viewChild
} from '@angular/core';
import { beforeRender, extend, NgtArgs } from "angular-three";
import { gltfResource } from 'angular-three-soba/loaders';
import { Mesh, PointLight, SphereGeometry, type Object3D } from 'three';
extend({ Mesh, SphereGeometry, PointLight })

@Component({
	selector: 'app-loading-scene',
	template: `
		<!-- angular logo model -->
		<ngt-primitive
			#logo
			*args="[aLogo()]"
			[position]="[-25, -10, -25]"
		/>

		<!-- particle light -->
		<ngt-mesh
			[position]="[0, 0, -20]"
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
	private logoRef = viewChild<ElementRef<Object3D>>('logo');
	aLogo = computed(() => {
        const gltf = this.model.asReadonly().value()?.alogo;
        if (!gltf) {
            return null;
        }
        return gltf.scene
    });

	protected model = gltfResource(() => ({ alogo: 'models/aLogo.glb' }), {
		onLoad(data) {}
	});
    constructor() {
		beforeRender(({ scene, delta }) => {
			const logoElement = this.logoRef()?.nativeElement;
			if (logoElement) {
				logoElement.rotation.y += 0.01;
			}
		});
	}

}