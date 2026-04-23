import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import ColdBootScanScene from '../../scene/cold-boot-scan';

@Component({
	selector: 'app-cold-boot-scan-page',
	templateUrl: './cold-boot-scan.html',
	styleUrls: ['./cold-boot-scan.css'],
	imports: [NgtCanvas, ColdBootScanScene],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ColdBootScanPage {}