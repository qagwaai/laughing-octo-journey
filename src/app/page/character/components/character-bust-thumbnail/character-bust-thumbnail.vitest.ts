import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BustDescriptorInput } from '../../../../model/bust-descriptor';
import CharacterBustThumbnail from './character-bust-thumbnail';

const descriptor: BustDescriptorInput = {
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
};

describe('CharacterBustThumbnail', () => {
  let fixture: ComponentFixture<CharacterBustThumbnail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterBustThumbnail],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterBustThumbnail);
  });

  it('shows a spinner while the bust is still loading', () => {
    fixture.componentRef.setInput('state', { status: 'loading' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bust-thumbnail__spinner')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bust-thumbnail__image')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.bust-thumbnail__silhouette')).toBeFalsy();
  });

  it('renders the portrait image once the descriptor loads', () => {
    fixture.componentRef.setInput('state', { status: 'loaded', descriptor });
    fixture.componentRef.setInput('alt', 'Character portrait');
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('.bust-thumbnail__image') as HTMLImageElement;
    expect(image).toBeTruthy();
    expect(image.getAttribute('src')).toBe(
      '/images/portraits/oval__medium__short-crop__brown__almond__green__focused__collar__none__none__none.jpeg',
    );
    expect(image.getAttribute('alt')).toBe('Character portrait');
  });

  it('falls back to a silhouette when the bust load fails', () => {
    fixture.componentRef.setInput('state', { status: 'error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bust-thumbnail__silhouette')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bust-thumbnail__image')).toBeFalsy();
  });

  it('falls back to a silhouette when the loaded image itself fails to render', () => {
    fixture.componentRef.setInput('state', { status: 'loaded', descriptor });
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('.bust-thumbnail__image') as HTMLImageElement;
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bust-thumbnail__silhouette')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bust-thumbnail__image')).toBeFalsy();
  });
});
