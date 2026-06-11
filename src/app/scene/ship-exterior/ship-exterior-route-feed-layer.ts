import { Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { NgtArgs } from 'angular-three';
import { ViewerShipMesh } from '../viewer/viewer-ship-mesh';

export interface ShipExteriorRouteSceneGate {
  id: string;
  displayName: string;
  position: [number, number, number];
  descriptorColor: string;
  emissive: string;
  emissiveIntensity: number;
  tubeRadius: number;
}

export interface ShipExteriorRouteSceneStation {
  id: string;
  displayName: string;
  position: [number, number, number];
  descriptorColor: string;
  emissive: string;
  emissiveIntensity: number;
  scale: [number, number, number];
}

export interface ShipExteriorRouteSceneEncounterShip {
  id: string;
  displayName: string;
  model: string;
  position: [number, number, number];
  color: string;
}

@Component({
  selector: 'app-ship-exterior-route-feed-layer',
  template: `
    @for (gate of gates(); track gate.id) {
      <ngt-group [position]="gate.position" [name]="gate.displayName">
        <ngt-mesh [rotation]="[Math.PI / 2, 0, 0]">
          <ngt-torus-geometry *args="[1.35, gate.tubeRadius, 20, 48]" />
          <ngt-mesh-standard-material
            [color]="gate.descriptorColor"
            [emissive]="gate.emissive"
            [emissiveIntensity]="gate.emissiveIntensity"
            [roughness]="0.48"
            [metalness]="0.5"
          />
        </ngt-mesh>
      </ngt-group>
    }

    @for (station of stations(); track station.id) {
      <ngt-group [position]="station.position" [name]="station.displayName" [scale]="station.scale">
        <ngt-mesh>
          <ngt-octahedron-geometry *args="[0.62, 0]" />
          <ngt-mesh-standard-material
            [color]="station.descriptorColor"
            [emissive]="station.emissive"
            [emissiveIntensity]="station.emissiveIntensity"
            [roughness]="0.62"
            [metalness]="0.34"
          />
        </ngt-mesh>
      </ngt-group>
    }

    @for (encounterShip of encounterShips(); track encounterShip.id) {
      <ngt-group [position]="encounterShip.position" [name]="encounterShip.displayName">
        <app-viewer-ship-mesh
          [model]="encounterShip.model"
          [color]="encounterShip.color"
          [targeted]="false"
          [isActive]="false"
        />
      </ngt-group>
    }
  `,
  imports: [NgtArgs, ViewerShipMesh],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ShipExteriorRouteFeedLayer {
  gates = input.required<readonly ShipExteriorRouteSceneGate[]>();
  stations = input.required<readonly ShipExteriorRouteSceneStation[]>();
  encounterShips = input.required<readonly ShipExteriorRouteSceneEncounterShip[]>();

  protected Math = Math;
}
