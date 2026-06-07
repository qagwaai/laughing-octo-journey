import { ComponentFixture, TestBed } from '@angular/core/testing';
import CharacterPreviewImageComponent, { buildPortraitFilename } from './character-preview-image';

describe('CharacterPreviewImageComponent', () => {
  let fixture: ComponentFixture<CharacterPreviewImageComponent>;
  let component: CharacterPreviewImageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterPreviewImageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterPreviewImageComponent);
    component = fixture.componentInstance;
  });

  it('builds the portrait filename from the current descriptor fields', () => {
    expect(
      buildPortraitFilename({
        presetVersion: 'sw-15-m2-a-v1',
        faceShape: 'oval',
        skinTone: 'medium',
        hairStyle: 'short-crop',
        hairColor: 'brown',
        eyeStyle: 'almond',
        eyeColor: 'green',
        expressionPreset: 'focused',
        apparelAccent: 'collar',
      }),
    ).toBe('oval__medium__short-crop__brown__almond__green__focused__collar.jpeg');
  });

  it('shows not-found text when the asset fails to load', () => {
    fixture.componentRef.setInput('descriptor', {
      presetVersion: 'sw-15-m2-a-v1',
      faceShape: 'oval',
      skinTone: 'medium',
      hairStyle: 'short-crop',
      hairColor: 'brown',
      eyeStyle: 'almond',
      eyeColor: 'green',
      expressionPreset: 'focused',
      apparelAccent: 'collar',
    });
    fixture.detectChanges();

    (component as any).handleImageError();

    expect(component.debugLabel()).toContain('not-found - oval__medium__short-crop__brown__almond__green__focused__collar.jpeg');
    expect(fixture.nativeElement.textContent).toContain('not-found - oval__medium__short-crop__brown__almond__green__focused__collar.jpeg');
  });
});