import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-cold-boot-scan-page',
  templateUrl: './cold-boot-scan.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Blank route placeholder for the ship-exterior scan sequence.
 */
export default class ColdBootScanPage {
}
