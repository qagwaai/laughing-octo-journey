import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { locale } from '../../i18n/locale';
import { CharacterBustPreviewStateService } from '../../services/character-bust-preview-state.service';
import { CharacterBustViewerComponent } from './components/character-bust-viewer/character-bust-viewer';

@Component({
  selector: 'app-character-bust-preview-pane',
  templateUrl: './character-bust-preview-pane.html',
  styleUrls: ['./character-bust-preview-pane.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CharacterBustViewerComponent],
})
export default class CharacterBustPreviewPaneComponent {
  protected readonly t = locale;
  private readonly previewState = inject(CharacterBustPreviewStateService);

  protected readonly descriptor = computed(() => this.previewState.descriptor());
}
