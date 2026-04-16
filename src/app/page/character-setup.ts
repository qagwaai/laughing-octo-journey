import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
	selector: 'app-character-setup-page',
	templateUrl: './character-setup.html',
	styleUrls: ['./character-setup.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
})
export default class CharacterSetupPage {
	private fb = inject(FormBuilder);
	private router = inject(Router);

	protected playerName = signal<string>(
		(this.router.getCurrentNavigation()?.extras.state?.['playerName'] as string | undefined) ??
			(history.state?.playerName as string | undefined) ??
			'',
	);

	protected characterForm = this.fb.group({
		characterName: [
			this.playerName(),
			[Validators.required, Validators.minLength(2), Validators.maxLength(24)],
		],
	});

	protected isSaved = signal(false);
	protected successMessage = signal<string | null>(null);

	saveCharacter(): void {
		if (this.characterForm.invalid) {
			this.characterForm.markAllAsTouched();
			return;
		}

		const characterName = this.characterForm.value.characterName!;
		this.isSaved.set(true);
		this.successMessage.set(`Character '${characterName}' is ready for launch.`);
	}
}
