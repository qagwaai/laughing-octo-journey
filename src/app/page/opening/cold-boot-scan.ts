import { ChangeDetectionStrategy, Component, computed, viewChild } from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import ShipExteriorViewScene from '../../scene/ship-exterior-view';

const DEFAULT_HOTKEY_SLOTS: ReadonlyArray<{
	hotkey: 1 | 2 | 3 | 4 | 5;
	item: null;
	label: string;
	enabled: boolean;
	launching: boolean;
}> = [
	{ hotkey: 1, item: null, label: 'empty', enabled: false, launching: false },
	{ hotkey: 2, item: null, label: 'empty', enabled: false, launching: false },
	{ hotkey: 3, item: null, label: 'empty', enabled: false, launching: false },
	{ hotkey: 4, item: null, label: 'empty', enabled: false, launching: false },
	{ hotkey: 5, item: null, label: 'empty', enabled: false, launching: false },
];

@Component({
	selector: 'app-cold-boot-scan-page',
	templateUrl: './cold-boot-scan.html',
	styleUrls: ['./cold-boot-scan.css'],
	imports: [NgtCanvas, ShipExteriorViewScene],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ColdBootScanPage {
	private shipExteriorView = viewChild(ShipExteriorViewScene);

	protected showPropertiesPanel = computed(() => this.shipExteriorView()?.showPropertiesPanel() ?? false);
	protected showPropertiesPanelReveal = computed(() => this.shipExteriorView()?.showPropertiesPanelReveal() ?? false);
	protected propertiesPanelTitle = computed(() => this.shipExteriorView()?.propertiesPanelTitle() ?? 'ASTEROID // PROPERTIES');
	protected propertiesMaterialText = computed(() => this.shipExteriorView()?.propertiesMaterialText() ?? 'MATERIAL: UNKNOWN');
	protected propertiesRarityText = computed(() => this.shipExteriorView()?.propertiesRarityText() ?? 'RARITY: UNKNOWN');
	protected propertiesVelocityText = computed(() => this.shipExteriorView()?.propertiesVelocityText() ?? 'VEL: ---');
	protected propertiesSpinText = computed(() => this.shipExteriorView()?.propertiesSpinText() ?? 'SPIN: ---');
	protected propertiesMassText = computed(() => this.shipExteriorView()?.propertiesMassText() ?? 'MASS: ---');
	protected propertiesDiameterText = computed(() => this.shipExteriorView()?.propertiesDiameterText() ?? 'DIAM: ---');
	protected propertiesLocationText = computed(() => this.shipExteriorView()?.propertiesLocationText() ?? 'LOC(Mkm): ---');
	protected propertiesClusterText = computed(() => this.shipExteriorView()?.propertiesClusterText() ?? 'CLUSTER(Mkm): ---');
	protected propertiesOffsetText = computed(() => this.shipExteriorView()?.propertiesOffsetText() ?? 'OFFSET(km): ---');
	protected launchHotkeySlots = computed(() => this.shipExteriorView()?.launchHotkeySlots() ?? DEFAULT_HOTKEY_SLOTS);
	protected activeLaunchToast = computed(() => this.shipExteriorView()?.activeLaunchToast() ?? null);
	protected missionObjectiveText = computed(
		() => this.shipExteriorView()?.missionObjectiveText() ?? 'Objective unavailable.',
	);

	protected hidePropertiesPanel(): void {
		this.shipExteriorView()?.hidePropertiesPanel();
	}

	protected revealPropertiesPanel(): void {
		this.shipExteriorView()?.revealPropertiesPanel();
	}

	protected launchFromHotkeySlot(hotkey: 1 | 2 | 3 | 4 | 5): void {
		this.shipExteriorView()?.launchFromHotkeySlot(hotkey);
	}
}