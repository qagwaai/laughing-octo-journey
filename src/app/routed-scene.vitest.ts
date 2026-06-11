import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RoutedScene } from './routed-scene';

function setup() {
  TestBed.configureTestingModule({
    imports: [RoutedScene],
    providers: [provideRouter([])],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  TestBed.overrideComponent(RoutedScene, {
    set: {
      imports: [],
      template: `
				@defer (prefetch on idle) {
					<router-outlet />
				} @placeholder (minimum 5s) {
					<app-loading-scene />
				}
			`,
    },
  });

  const fixture = TestBed.createComponent(RoutedScene);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

describe('RoutedScene', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should create the real routing shell component', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('should not render app-current at shell level', () => {
    const { fixture } = setup();
    const native = fixture.nativeElement as HTMLElement;

    expect(native.querySelector('app-current')).toBeNull();
  });
});
