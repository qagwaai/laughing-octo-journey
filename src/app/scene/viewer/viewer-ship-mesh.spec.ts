import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SHIP_GLTF_RESOURCE_FN } from '../../component/ship-model-mesh';
import {
  resolveViewerShipMeshKind,
  ViewerScavengerPodMesh,
  ViewerShipMesh,
} from './viewer-ship-mesh';

describe('viewer-ship-mesh', () => {
  let shipGltfResourceSpy: jasmine.Spy;

  beforeEach(async () => {
    shipGltfResourceSpy = jasmine.createSpy('shipGltfResource').and.callFake(() => ({
      asReadonly: () => ({
        value: () => null,
      }),
    }));

    await TestBed.configureTestingModule({
      imports: [ViewerScavengerPodMesh, ViewerShipMesh],
      providers: [{ provide: SHIP_GLTF_RESOURCE_FN, useValue: shipGltfResourceSpy }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('resolves Scavenger Pod models to GLB mesh kind', () => {
    expect(resolveViewerShipMeshKind('Scavenger Pod')).toBe('glb');
    expect(resolveViewerShipMeshKind('  scavenger   pod  ')).toBe('glb');
  });

  it('resolves unknown models to generic mesh kind', () => {
    expect(resolveViewerShipMeshKind('Courier Mk2')).toBe('generic');
  });

  it('binds app-viewer-scavenger-pod-mesh to the scavenger pod GLB asset path', () => {
    const fixture: ComponentFixture<ViewerScavengerPodMesh> = TestBed.createComponent(ViewerScavengerPodMesh);
    fixture.detectChanges();

    expect(shipGltfResourceSpy).toHaveBeenCalled();
    const args = shipGltfResourceSpy.calls.mostRecent().args as [() => { ship: string }, object];
    const resourceFactory = args[0];

    expect(resourceFactory().ship).toBe('models/ships/scavenger-pod.glb');
  });

  it('renders ViewerShipMesh generic fallback without GLB loader for unknown models', () => {
    shipGltfResourceSpy.calls.reset();

    const fixture: ComponentFixture<ViewerShipMesh> = TestBed.createComponent(ViewerShipMesh);
    fixture.componentRef.setInput('model', 'Courier Mk2');
    fixture.detectChanges();

    expect(shipGltfResourceSpy).not.toHaveBeenCalled();
  });

  it('renders ViewerShipMesh GLB path for Scavenger Pod models', () => {
    shipGltfResourceSpy.calls.reset();

    const fixture: ComponentFixture<ViewerShipMesh> = TestBed.createComponent(ViewerShipMesh);
    fixture.componentRef.setInput('model', 'Scavenger Pod');
    fixture.detectChanges();

    expect(shipGltfResourceSpy).toHaveBeenCalled();
    const args = shipGltfResourceSpy.calls.mostRecent().args as [() => { ship: string }, object];
    const resourceFactory = args[0];

    expect(resourceFactory().ship).toBe('models/ships/scavenger-pod.glb');
  });
});