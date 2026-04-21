import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgtsText } from 'angular-three-soba/abstractions';

@Component({
	selector: 'app-hud-overlay',
	template: `
		<ngts-text
			[text]="title()"
			[options]="{ fontSize: 0.18, color: '#79ff9f', position: [-2.25, 1.95, 0.15], letterSpacing: 0.04 }"
		/>

		@for (line of systemChecks(); track line; let idx = $index) {
			<ngts-text
				[text]="line"
				[options]="{ fontSize: 0.11, color: '#b6ffc4', position: [-2.45, 1.65 - idx * 0.2, 0.15] }"
			/>
		}

		<ngts-text
			[text]="aiLabel()"
			[options]="{ fontSize: 0.12, color: '#8bd6ff', position: [-1.95, -0.55, 0.15], letterSpacing: 0.02 }"
		/>
		<ngts-text
			[text]="aiMessage()"
			[options]="{ fontSize: 0.09, color: '#d4ebff', position: [-0.95, -0.82, 0.15], maxWidth: 5.6 }"
		/>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgtsText],
})
export class HudOverlay {
	title = input<string>('COLD BOOT // TIER 1 SCAVENGER POD');
	systemChecks = input<string[]>([]);
	aiLabel = input<string>('AI LINK // DEGRADED CHANNEL');
	aiMessage = input<string>('');
}
