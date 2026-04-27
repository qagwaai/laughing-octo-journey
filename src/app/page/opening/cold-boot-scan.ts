import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import ShipExteriorViewScene from '../../scene/ship-exterior-view';

@Component({
	selector: 'app-cold-boot-scan-page',
	templateUrl: './cold-boot-scan.html',
	styleUrls: ['./cold-boot-scan.css'],
	imports: [NgtCanvas, ShipExteriorViewScene],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ColdBootScanPage {}