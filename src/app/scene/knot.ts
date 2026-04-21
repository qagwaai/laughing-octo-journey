import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgtArgs } from 'angular-three';
import { NgtsMeshTransmissionMaterial } from 'angular-three-soba/materials';
import { CurrentRoute } from '../component/current';

@Component({
	selector: 'app-knot',
	template: `
    	<ngt-color *args="['#f3f2f7']" attach="background" />
		<app-current [position]="[0, 0, -10]" [text]="'/knot'" />

		<ngt-mesh [receiveShadow]="true" [castShadow]="true">
			<ngt-torus-knot-geometry *args="[3, 1, 256, 32]" />
			<ngts-mesh-transmission-material [options]="{ backside: true, backsideThickness: 5, thickness: 2 }" />
		</ngt-mesh>
	`,
	imports: [NgtArgs, NgtsMeshTransmissionMaterial, CurrentRoute],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Knot {}