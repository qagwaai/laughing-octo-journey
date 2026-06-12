import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CharacterBustPreviewStateService } from '../../services/character-bust-preview-state.service';
import CharacterBustPreviewPaneComponent from './character-bust-preview-pane';

describe('CharacterBustPreviewPaneComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterBustPreviewPaneComponent],
    }).compileComponents();

    TestBed.inject(CharacterBustPreviewStateService).clear();
  });

  it('renders empty state when no descriptor is set', async () => {
    const fixture = TestBed.createComponent(CharacterBustPreviewPaneComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="character-bust-preview-pane"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Dedicated SW-15 portrait asset path reserved.');
  });

  it('renders the bust viewer when a descriptor is set', async () => {
    const state = TestBed.inject(CharacterBustPreviewStateService);
    state.updateDescriptor({
      presetVersion: 'sw-15-m2-a-v1',
      faceShape: 'oval',
      skinTone: 'medium',
      hairStyle: 'short-crop',
      hairColor: 'brown',
      eyeStyle: 'almond',
      eyeColor: 'green',
      expressionPreset: 'focused',
      apparelAccent: 'collar',
      facialHair: 'none',
      scar: 'none',
      tattoo: 'none',
    });

    const fixture = TestBed.createComponent(CharacterBustPreviewPaneComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="character-preview-image"]')).not.toBeNull();
  });
});
