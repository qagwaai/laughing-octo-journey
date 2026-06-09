import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  ShipExteriorRouteFeedLayer,
  type ShipExteriorRouteSceneEncounterShip,
  type ShipExteriorRouteSceneGate,
  type ShipExteriorRouteSceneStation,
} from './ship-exterior-route-feed-layer';

@Component({
  template: `
    <app-ship-exterior-route-feed-layer
      [gates]="gates"
      [stations]="stations"
      [encounterShips]="encounterShips"
    />
  `,
  imports: [ShipExteriorRouteFeedLayer],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class HostComponent {
  gates: ShipExteriorRouteSceneGate[] = [];
  stations: ShipExteriorRouteSceneStation[] = [];
  encounterShips: ShipExteriorRouteSceneEncounterShip[] = [];
}

describe('ShipExteriorRouteFeedLayer', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
  });

  it('renders one viewer mesh per encounter ship', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.encounterShips = [
      {
        id: 'ship-1',
        displayName: 'Corsair',
        model: 'Raider',
        position: [1, 2, 3],
        color: '#ef4444',
      },
      {
        id: 'ship-2',
        displayName: 'Freighter',
        model: 'Hauler',
        position: [4, 5, 6],
        color: '#38bdf8',
      },
    ];

    fixture.detectChanges();

    const meshes = fixture.debugElement.queryAll(By.css('app-viewer-ship-mesh'));
    expect(meshes.length).toBe(2);
  });

  it('renders no viewer meshes when encounter ship feed is empty', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const meshes = fixture.debugElement.queryAll(By.css('app-viewer-ship-mesh'));
    expect(meshes.length).toBe(0);
  });
});
