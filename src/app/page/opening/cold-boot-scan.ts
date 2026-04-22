import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'app-cold-boot-scan-page',
	templateUrl: './cold-boot-scan.html',
	styleUrls: ['./cold-boot-scan.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ColdBootScanPage {}