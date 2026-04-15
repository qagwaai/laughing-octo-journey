import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'app-intro-page',
	template: `
		<div class="intro-container">
			<h1>{{ projectName }}</h1>
			<p>Welcome to {{ projectName }}</p>
		</div>
	`,
	styles: [`
		.intro-container {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			font-family: Arial, sans-serif;
		}

		h1 {
			font-size: 3rem;
			margin: 0;
			margin-bottom: 20px;
			text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
		}

		p {
			font-size: 1.5rem;
			margin: 0;
			text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
		}
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class IntroPage {
	protected projectName = 'ngt-template';
}
