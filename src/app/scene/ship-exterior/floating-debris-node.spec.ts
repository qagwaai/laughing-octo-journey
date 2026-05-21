import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FloatingDebrisNode,
  FLOATING_DEBRIS_BEFORE_RENDER_FN,
  type FloatingDebrisPointerEvent,
} from './floating-debris-node';
import type { FloatingDebrisItem } from '../../model/floating-debris-item';

@Component({
  template: `
    <app-floating-debris-node
      [item]="item"
      [position]="position"
      [targeted]="targeted"
      (pointerButtonDown)="downEvents.push($event)"
      (pointerButtonUp)="upEvents.push($event)"
    />
  `,
  imports: [FloatingDebrisNode],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class HostComponent {
  item: FloatingDebrisItem = {
    id: 'debris-1',
    itemType: 'debris_scrap',
    displayName: 'Scrap',
    positionKm: { x: 0, y: 0, z: 0 },
  };
  position: [number, number, number] = [0, 0, 0];
  targeted = false;
  downEvents: FloatingDebrisPointerEvent[] = [];
  upEvents: FloatingDebrisPointerEvent[] = [];

  @ViewChild(FloatingDebrisNode) node!: FloatingDebrisNode;
}

describe('FloatingDebrisNode', () => {
  function makeFixture() {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: FLOATING_DEBRIS_BEFORE_RENDER_FN, useValue: () => undefined }],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('emits pointerButtonDown for right-button (button === 2)', () => {
    const fixture = makeFixture();
    const host = fixture.componentInstance;
    (host.node as unknown as { onPointerDown(e: unknown): void }).onPointerDown({ button: 2 });
    expect(host.downEvents).toEqual([{ id: 'debris-1', button: 2 }]);
  });

  it('ignores pointerdown for left-button (negative)', () => {
    const fixture = makeFixture();
    const host = fixture.componentInstance;
    (host.node as unknown as { onPointerDown(e: unknown): void }).onPointerDown({ button: 0 });
    expect(host.downEvents).toEqual([]);
  });

  it('emits pointerButtonUp for right-button (button === 2)', () => {
    const fixture = makeFixture();
    const host = fixture.componentInstance;
    (host.node as unknown as { onPointerUp(e: unknown): void }).onPointerUp({ button: 2 });
    expect(host.upEvents).toEqual([{ id: 'debris-1', button: 2 }]);
  });

  it('ignores pointerup for non-right buttons (negative)', () => {
    const fixture = makeFixture();
    const host = fixture.componentInstance;
    (host.node as unknown as { onPointerUp(e: unknown): void }).onPointerUp({ button: 1 });
    expect(host.upEvents).toEqual([]);
  });

  it('reads right-button from nativeEvent fallback', () => {
    const fixture = makeFixture();
    const host = fixture.componentInstance;
    (host.node as unknown as { onPointerDown(e: unknown): void }).onPointerDown({ nativeEvent: { button: 2 } });
    expect(host.downEvents).toEqual([{ id: 'debris-1', button: 2 }]);
  });
});
