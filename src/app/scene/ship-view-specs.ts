import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { textureResource } from "angular-three-soba/loaders";
import { CurrentRoute } from '../component/current';
import { ExpendableDartShip } from "../component/expendable-dart-drone";
import { PlayerCharacterSummary } from '../model/character-list';
import { ShipSummary } from '../model/ship-list';

interface ShipViewSpecsNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	joinShip?: ShipSummary;
}

@Component({
	selector: 'app-ship-view-specs',
	templateUrl: './ship-view-specs.html',
	imports: [NgtArgs, ExpendableDartShip, NgtsOrbitControls, CurrentRoute],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShipViewSpecs {
	private router = inject(Router);
	private navigationState: ShipViewSpecsNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ShipViewSpecsNavigationState | undefined) ??
		(history.state as ShipViewSpecsNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);

	protected textures = textureResource(() => ({
		specsheet: "images/Expendable_Dart_Drone_Gemini_Generated_Image_vzq3vfvzq3vfvzq3.png"
	}));

	// Expose Math for template usage with lighting calculations
	protected Math = Math;
}
