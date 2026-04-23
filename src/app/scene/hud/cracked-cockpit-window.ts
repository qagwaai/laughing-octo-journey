import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component } from '@angular/core';
import { NgtArgs } from 'angular-three';

@Component({
	selector: 'app-cracked-cockpit-window',
	template: `
		<ngt-group>
			<ngt-mesh name="cockpit-glass" [position]="[0, 0, 0.5]">
				<ngt-plane-geometry *args="[7.8, 4.6]" />
				<ngt-mesh-standard-material
					[color]="'#91cbff'"
					[transparent]="true"
					[opacity]="0.08"
					[metalness]="0.3"
					[roughness]="0.12"
				/>
			</ngt-mesh>

			<ngt-mesh name="frame-top" [position]="[0, 2.28, 0.52]">
				<ngt-box-geometry *args="[7.9, 0.08, 0.08]" />
				<ngt-mesh-standard-material [color]="'#2a3542'" [metalness]="0.75" [roughness]="0.35" />
			</ngt-mesh>
			<ngt-mesh name="frame-bottom" [position]="[0, -2.28, 0.52]">
				<ngt-box-geometry *args="[7.9, 0.08, 0.08]" />
				<ngt-mesh-standard-material [color]="'#2a3542'" [metalness]="0.75" [roughness]="0.35" />
			</ngt-mesh>
			<ngt-mesh name="frame-left" [position]="[-3.9, 0, 0.52]">
				<ngt-box-geometry *args="[0.08, 4.6, 0.08]" />
				<ngt-mesh-standard-material [color]="'#2a3542'" [metalness]="0.75" [roughness]="0.35" />
			</ngt-mesh>
			<ngt-mesh name="frame-right" [position]="[3.9, 0, 0.52]">
				<ngt-box-geometry *args="[0.08, 4.6, 0.08]" />
				<ngt-mesh-standard-material [color]="'#2a3542'" [metalness]="0.75" [roughness]="0.35" />
			</ngt-mesh>

			<ngt-mesh name="crack-a" [position]="[0.55, 0.6, 0.58]" [rotation]="[0, 0, 0.54]">
				<ngt-box-geometry *args="[2.5, 0.02, 0.02]" />
				<ngt-mesh-basic-material [color]="'#d2f1ff'" [transparent]="true" [opacity]="0.7" />
			</ngt-mesh>
			<ngt-mesh name="crack-b" [position]="[-0.15, 0.26, 0.58]" [rotation]="[0, 0, -0.82]">
				<ngt-box-geometry *args="[1.65, 0.015, 0.02]" />
				<ngt-mesh-basic-material [color]="'#d2f1ff'" [transparent]="true" [opacity]="0.62" />
			</ngt-mesh>
			<ngt-mesh name="crack-c" [position]="[1.24, 0.18, 0.58]" [rotation]="[0, 0, -0.22]">
				<ngt-box-geometry *args="[1.25, 0.015, 0.02]" />
				<ngt-mesh-basic-material [color]="'#d2f1ff'" [transparent]="true" [opacity]="0.62" />
			</ngt-mesh>
			<ngt-mesh name="crack-d" [position]="[0.8, -0.1, 0.58]" [rotation]="[0, 0, 0.14]">
				<ngt-box-geometry *args="[0.9, 0.012, 0.02]" />
				<ngt-mesh-basic-material [color]="'#d2f1ff'" [transparent]="true" [opacity]="0.55" />
			</ngt-mesh>
		</ngt-group>
	`,
	imports: [NgtArgs],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrackedCockpitWindow {}
