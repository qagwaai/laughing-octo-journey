import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { NgtArgs } from 'angular-three';
import { resolveShipAssetPath } from '../../model/catalog/ship-asset-catalog';
import { coerceShipModel } from '../../model/ship-list';
import { ShipModelMesh } from '../../component/ship-model-mesh';

export type ViewerShipMeshKind = 'glb' | 'generic';

const SCAVENGER_POD_ASSET_PATH = resolveShipAssetPath('scavenger-pod') ?? 'models/ships/scavenger-pod.glb';

function normalizeShipModelToken(model: string): string {
  return model.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s/g, '-');
}

export function resolveViewerShipMeshKind(model: unknown): ViewerShipMeshKind {
  const key = normalizeShipModelToken(coerceShipModel(model));
  return resolveShipAssetPath(key) !== null ? 'glb' : 'generic';
}

@Component({
  selector: 'app-viewer-scavenger-pod-mesh',
  template: `
    <ngt-group [scale]="0.1">
      <app-ship-model-mesh
        [assetPath]="assetPath"
        [color]="color()"
        [targeted]="targeted()"
        [isActive]="isActive()"
      />
    </ngt-group>
  `,
  imports: [ShipModelMesh],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerScavengerPodMesh {
  protected readonly assetPath = SCAVENGER_POD_ASSET_PATH;
  color = input<string>('#3b82f6');
  targeted = input(false);
  isActive = input(false);
}

@Component({
  selector: 'app-viewer-ship-mesh',
  template: `
    @switch (meshKind()) {
      @case ('glb') {
        <ngt-group [scale]="0.1">
          <app-ship-model-mesh
            [assetPath]="assetPath()"
            [color]="color()"
            [targeted]="targeted()"
            [isActive]="isActive()"
          />
        </ngt-group>
      }
      @default {
        <ngt-mesh>
          <ngt-box-geometry *args="[0.08, 0.08, 0.08]" />
          <ngt-mesh-standard-material
            [color]="color()"
            [roughness]="0.5"
            [metalness]="0.3"
            [emissive]="targeted() ? '#92400e' : isActive() ? '#78350f' : '#1e3a5f'"
            [emissiveIntensity]="targeted() ? 0.65 : 0.4"
          />
        </ngt-mesh>
      }
    }
  `,
  imports: [NgtArgs, ShipModelMesh],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerShipMesh {
  model = input<string>('Scavenger Pod');
  color = input<string>('#3b82f6');
  targeted = input(false);
  isActive = input(false);

  protected readonly meshKind = computed(() => resolveViewerShipMeshKind(this.model()));

  protected readonly assetPath = computed(
    () => resolveShipAssetPath(normalizeShipModelToken(coerceShipModel(this.model()))) ?? '',
  );
}