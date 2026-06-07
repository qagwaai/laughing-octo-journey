import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { locale } from '../../i18n/locale';
import { CharacterBustPreviewStateService } from '../../services/character-bust-preview-state.service';
import CharacterPreviewImageComponent from './components/character-preview-image/character-preview-image';

@Component({
  selector: 'app-character-bust-preview-pane',
  templateUrl: './character-bust-preview-pane.html',
  styleUrls: ['./character-bust-preview-pane.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CharacterPreviewImageComponent],
})
export default class CharacterBustPreviewPaneComponent {
  protected readonly t = locale;
  private readonly previewState = inject(CharacterBustPreviewStateService);

  protected readonly descriptor = computed(() => this.previewState.descriptor());
}
