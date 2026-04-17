import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgtArgs } from 'angular-three';
import { NgtsMeshTransmissionMaterial } from 'angular-three-soba/materials';
import { PlayerCharacterSummary } from '../model/character-list';
import { DroneSummary } from '../model/drone-list';
import { ExpendableDartDrone } from "../component/expendable-dart-drone";
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { textureResource } from "angular-three-soba/loaders";

interface DroneViewSpecsNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	joinDrone?: DroneSummary;
}

@Component({
	selector: 'app-drone-view-specs',
	templateUrl: './drone-view-specs.html',
	imports: [NgtArgs, NgtsMeshTransmissionMaterial, ExpendableDartDrone, NgtsOrbitControls],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class DroneViewSpecs {
	private router = inject(Router);
	private navigationState: DroneViewSpecsNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as DroneViewSpecsNavigationState | undefined) ??
		(history.state as DroneViewSpecsNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected joinDrone = signal<DroneSummary | null>(this.navigationState.joinDrone ?? null);

	protected textures = textureResource(() => ({
		specsheet: "images/Expendable_Dart_Drone_Gemini_Generated_Image_vzq3vfvzq3vfvzq3.png"
	}));

}
