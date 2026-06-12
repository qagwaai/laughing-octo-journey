import { beforeEach, describe, expect, it } from 'vitest';
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
        facialHair: 'none',
        scar: 'none',
        tattoo: 'none',
      }),
    ).toBe('oval__medium__short-crop__brown__almond__green__focused__collar__none__none__none.jpeg');
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
      facialHair: 'none',
      scar: 'none',
      tattoo: 'none',
    });
    fixture.detectChanges();

    (component as any).handleImageError();
    fixture.detectChanges();

    expect((component as any).debugLabel()).toContain('not-found - oval__medium__short-crop__brown__almond__green__focused__collar__none__none__none.jpeg');
    expect(fixture.nativeElement.textContent).toContain('not-found - oval__medium__short-crop__brown__almond__green__focused__collar__none__none__none.jpeg');
  });

  it('marks a cached image as loaded when the img element is already complete', () => {
    fixture.componentRef.setInput('descriptor', {
      presetVersion: 'sw-15-m2-a-v1',
      faceShape: 'oval',
      skinTone: 'tan',
      hairStyle: 'long-loose',
      hairColor: 'black',
      eyeStyle: 'round',
      eyeColor: 'hazel',
      expressionPreset: 'warm',
      apparelAccent: 'none',
      facialHair: 'short-beard',
      scar: 'cheek-right',
      tattoo: 'temple-left',
    });
    fixture.detectChanges();

    const currentImage = fixture.nativeElement.querySelector('.character-preview-image__image--current') as HTMLImageElement;
    Object.defineProperty(currentImage, 'complete', { configurable: true, get: () => true });
    Object.defineProperty(currentImage, 'naturalWidth', { configurable: true, get: () => 1024 });

    (component as any).syncCurrentImageState();
    fixture.detectChanges();

    expect((component as any).statusLabel()).toBe('loaded');
    expect(currentImage.classList.contains('character-preview-image__image--loaded')).toBe(true);
  });

  it('renders a full 11-field filename for non-default saved bust characteristics', () => {
    fixture.componentRef.setInput('descriptor', {
      presetVersion: 'sw-15-m2-a-v1',
      faceShape: 'angular',
      skinTone: 'deep',
      hairStyle: 'braided',
      hairColor: 'silver',
      eyeStyle: 'hooded',
      eyeColor: 'amber',
      expressionPreset: 'warm',
      apparelAccent: 'visor',
      facialHair: 'goatee',
      scar: 'chin',
      tattoo: 'neck-right',
    });
    fixture.detectChanges();

    const expectedFilename =
      'angular__deep__braided__silver__hooded__amber__warm__visor__goatee__chin__neck-right.jpeg';
    const assetName = fixture.nativeElement.querySelector('[data-testid="character-preview-image-asset-name"]');
    const currentImage = fixture.nativeElement.querySelector('.character-preview-image__image--current');

    expect((component as any).portraitFilename()).toBe(expectedFilename);
    expect((component as any).portraitSrc()).toBe(`/images/portraits/${expectedFilename}`);
    expect(assetName?.textContent).toContain(expectedFilename);
    expect(currentImage?.getAttribute('src')).toContain(expectedFilename);
  });
});