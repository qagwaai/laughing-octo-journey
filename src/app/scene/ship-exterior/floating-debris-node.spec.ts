import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FloatingDebrisNode,
  FLOATING_DEBRIS_BEFORE_RENDER_FN,
  type FloatingDebrisHoverEvent,
  type FloatingDebrisPointerEvent,
} from './floating-debris-node';
import type { FloatingDebrisItem } from '../../model/floating-debris-item';

@Component({
  template: `
    <app-floating-debris-node
      [item]="item"
      [descriptor]="item.externalObjectDescriptor ?? null"
      [position]="position"
      [targetingHold]="targetingHold"
      [targeted]="targeted"
      (pointerButtonDown)="downEvents.push($event)"
      (pointerButtonUp)="upEvents.push($event)"
      (hoverChange)="hoverEvents.push($event)"
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
  targetingHold = false;
  targeted = false;
  downEvents: FloatingDebrisPointerEvent[] = [];
  upEvents: FloatingDebrisPointerEvent[] = [];
  hoverEvents: FloatingDebrisHoverEvent[] = [];

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

  it('emits hoverChange true on emitHover(true) and false on emitHover(false)', () => {
    const fixture = makeFixture();
    const host = fixture.componentInstance;
    const node = host.node as unknown as { emitHover(h: boolean): void; hovered: () => boolean };
    node.emitHover(true);
    expect(node.hovered()).toBeTrue();
    expect(host.hoverEvents).toEqual([{ id: 'debris-1', hovering: true }]);
    node.emitHover(false);
    expect(node.hovered()).toBeFalse();
    expect(host.hoverEvents).toEqual([
      { id: 'debris-1', hovering: true },
      { id: 'debris-1', hovering: false },
    ]);
  });

  it('exposes asteroid-style hold and target ring opacities from inputs', () => {
    const fixture = makeFixture();
    const host = fixture.componentInstance;

    host.targetingHold = true;
    host.targeted = true;
    fixture.detectChanges();

    const node = host.node as unknown as {
      targetHoldRingOpacity: () => number;
      targetedRingOpacity: () => number;
    };

    expect(node.targetHoldRingOpacity()).toBe(0.92);
    expect(node.targetedRingOpacity()).toBe(0.9);
  });

  it('resolves descriptor-driven debris profile when descriptor input is provided', () => {
    const fixture = makeFixture();
    const host = fixture.componentInstance;

    host.item = {
      ...host.item,
      externalObjectDescriptor: {
        descriptorId: 'debris-cargo-canister-test',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'debris',
        objectFamily: 'cargo-canister',
        roleCue: 'salvage',
        factionCue: 'unattributed',
        fallbackTier: 'standard',
        displayLabel: 'Cargo Canister',
        silhouetteProfile: 'cargo-canister',
        materialProfile: 'cargo-canister',
        emissiveProfile: 'medium',
      },
    };
    fixture.detectChanges();

    const node = host.node as unknown as {
      descriptorProfile: () => { domain: string; objectFamily: string } | null;
      geometryKind: () => string;
    };
    expect(node.descriptorProfile()).toEqual(
      jasmine.objectContaining({
        domain: 'debris',
        objectFamily: 'cargo-canister',
      }),
    );
    expect(node.geometryKind()).toBe('capsule');
  });
});
