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

  it('renders one gate torus per gate feed item', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.gates = [
      {
        id: 'gate-1',
        displayName: 'Gate One',
        descriptorColor: '#22c55e',
        emissive: '#14532d',
        emissiveIntensity: 0.4,
        tubeRadius: 0.2,
        position: [0, 0, 0],
      },
      {
        id: 'gate-2',
        displayName: 'Gate Two',
        descriptorColor: '#3b82f6',
        emissive: '#1e3a8a',
        emissiveIntensity: 0.5,
        tubeRadius: 0.25,
        position: [2, 0, 0],
      },
    ];

    fixture.detectChanges();

    const geometries = fixture.debugElement.queryAll(By.css('ngt-torus-geometry'));
    expect(geometries.length).toBe(2);
  });

  it('renders one station octahedron per station feed item and updates when inputs change', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.stations = [
      {
        id: 'station-1',
        displayName: 'Station One',
        descriptorColor: '#f97316',
        emissive: '#7c2d12',
        emissiveIntensity: 0.45,
        position: [1, 0, 0],
        scale: [1, 1, 1],
      },
      {
        id: 'station-2',
        displayName: 'Station Two',
        descriptorColor: '#eab308',
        emissive: '#713f12',
        emissiveIntensity: 0.5,
        position: [3, 0, 0],
        scale: [1.1, 1.1, 1.1],
      },
    ];

    fixture.detectChanges();

    let geometries = fixture.debugElement.queryAll(By.css('ngt-octahedron-geometry'));
    expect(geometries.length).toBe(2);

    host.stations = [
      {
        id: 'station-3',
        displayName: 'Station Three',
        descriptorColor: '#a855f7',
        emissive: '#581c87',
        emissiveIntensity: 0.55,
        position: [5, 0, 0],
        scale: [0.9, 0.9, 0.9],
      },
    ];

    fixture.detectChanges();

    geometries = fixture.debugElement.queryAll(By.css('ngt-octahedron-geometry'));
    expect(geometries.length).toBe(1);
  });
});
