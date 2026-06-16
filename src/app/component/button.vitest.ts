import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Triplet } from '@pmndrs/cannon-worker-api';

import { Button, BUTTON_BOX_FN } from './button';

function setup() {
  const boxFnSpy = vi.fn().mockReturnValue((() => null) as any);

  TestBed.configureTestingModule({
    imports: [Button],
    providers: [{ provide: BUTTON_BOX_FN, useValue: boxFnSpy }],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  TestBed.overrideComponent(Button, {
    set: {
      imports: [],
      template: '<ngt-mesh #mesh></ngt-mesh>',
    },
  });

  const fixture = TestBed.createComponent(Button);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance, boxFnSpy };
}

describe('Button', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should create component and initialize physics binding', () => {
    const { component, boxFnSpy } = setup();

    expect(component).toBeTruthy();
    expect(boxFnSpy).toHaveBeenCalled();
  });

  it('should expose default input values', () => {
    const { component } = setup();

    expect(component.position()).toEqual([0, 0, 0] as Triplet);
    expect(component.color()).toBe('red');
    expect(component.hoverColor()).toBe('darkred');
  });

  it('should accept input overrides', () => {
    const { fixture, component } = setup();

    fixture.componentRef.setInput('position', [1, 2, 3] as Triplet);
    fixture.componentRef.setInput('color', '#00ff00');
    fixture.componentRef.setInput('hoverColor', '#22aa22');
    fixture.detectChanges();

    expect(component.position()).toEqual([1, 2, 3] as Triplet);
    expect(component.color()).toBe('#00ff00');
    expect(component.hoverColor()).toBe('#22aa22');
  });

  it('should emit click output with null payload', () => {
    const { component } = setup();
    const clickSpy = vi.fn();

    component.click.subscribe(clickSpy);
    component.onClick();

    expect(clickSpy).toHaveBeenCalledWith(null);
  });

  it('should toggle clicked state on each click', () => {
    const { component } = setup();

    expect((component as any).clicked()).toBe(false);
    component.onClick();
    expect((component as any).clicked()).toBe(true);
    component.onClick();
    expect((component as any).clicked()).toBe(false);
  });

  it('should log click state transitions', () => {
    const { component } = setup();
    const logSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    component.onClick();

    expect(logSpy).toHaveBeenCalledWith('Button clicked: clicked state is now', true);
  });
});
