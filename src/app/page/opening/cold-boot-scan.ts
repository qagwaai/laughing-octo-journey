import { ChangeDetectionStrategy, Component, computed, viewChild } from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import ShipExteriorViewScene from '../../scene/ship-exterior-view';

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

	protected hidePropertiesPanel(): void {
		this.shipExteriorView()?.hidePropertiesPanel();
	}

	protected revealPropertiesPanel(): void {
		this.shipExteriorView()?.revealPropertiesPanel();
	}
}