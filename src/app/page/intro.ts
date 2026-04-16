import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'app-intro-page',
	templateUrl: './intro.html',
	styleUrls: ['./intro.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class IntroPage {
	protected projectName = 'Stellar';
}
