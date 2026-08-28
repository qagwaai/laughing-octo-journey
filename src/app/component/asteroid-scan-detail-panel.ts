import { Component, computed, input, signal } from '@angular/core';
import type { ShipSceneAsteroidSample, ShipSceneScannableShipSample } from '../scene/ship-exterior/ship-scene-types';

type ShipExteriorScanDetail =
  | { kind: 'asteroid'; sample: ShipSceneAsteroidSample }
  | { kind: 'ship'; sample: ShipSceneScannableShipSample };

@Component({
  selector: 'app-asteroid-scan-detail-panel',
  standalone: true,
  templateUrl: './asteroid-scan-detail-panel.html',
  styleUrls: ['./asteroid-scan-detail-panel.css'],
})
export class AsteroidScanDetailPanel {
  sample = input<ShipExteriorScanDetail | null>(null);

  protected collapsed = signal(false);
  protected asteroidSample = computed(() => {
    const sample = this.sample();
    return sample?.kind === 'asteroid' ? sample.sample : null;
  });
  protected shipSample = computed(() => {
    const sample = this.sample();
    return sample?.kind === 'ship' ? sample.sample : null;
  });
  protected isShipSample = computed(() => this.sample()?.kind === 'ship');

  protected materialLine = computed(() => {
    const s = this.asteroidSample();
    if (!s || !s.scanned || !s.revealedMaterial) {
      return null;
    }
    return s.revealedMaterial.material;
  });

  protected rarityLine = computed(() => {
    const s = this.asteroidSample();
    if (!s || !s.scanned || !s.revealedMaterial) {
      return null;
    }
    return s.revealedMaterial.rarity;
  });

  protected velocityLine = computed(() => {
    const k = this.asteroidSample()?.revealedKinematics;
    if (!k) {
      return null;
    }
    const { x, y, z } = k.velocityKmPerSec;
    const speed = Math.sqrt(x * x + y * y + z * z);
    return `${speed.toFixed(1)} km/s`;
  });

  protected spinLine = computed(() => {
    const k = this.asteroidSample()?.revealedKinematics;
    if (!k) {
      return null;
    }
    const { x, y, z } = k.angularVelocityRadPerSec;
    const spin = Math.sqrt(x * x + y * y + z * z);
    return `${spin.toFixed(4)} rad/s`;
  });

  protected massLine = computed(() => {
    const k = this.asteroidSample()?.revealedKinematics;
    if (!k) {
      return null;
    }
    const kg = k.estimatedMassKg;
    if (kg >= 1e12) {
      return `${(kg / 1e12).toFixed(2)}e12 kg`;
    }
    if (kg >= 1e9) {
      return `${(kg / 1e9).toFixed(2)}e9 kg`;
    }
    return `${kg.toFixed(0)} kg`;
  });

  protected diameterLine = computed(() => {
    const k = this.asteroidSample()?.revealedKinematics;
    if (!k) {
      return null;
    }
    return k.estimatedDiameterM >= 1000
      ? `${(k.estimatedDiameterM / 1000).toFixed(2)} km`
      : `${k.estimatedDiameterM} m`;
  });

  protected locationLine = computed(() => {
    const loc = this.asteroidSample()?.solarSystemLocation;
    if (!loc) {
      return null;
    }
    const { x, y, z } = loc.positionKm;
    return `X ${(x / 1e6).toFixed(3)}  Y ${(y / 1e6).toFixed(3)}  Z ${(z / 1e6).toFixed(3)} (Mkm)`;
  });

  protected clusterLine = computed(() => {
    const c = this.asteroidSample()?.clusterCenterKm;
    if (!c) {
      return null;
    }
    const loc = this.asteroidSample()?.solarSystemLocation;
    if (!loc) {
      return `X ${(c.x / 1e6).toFixed(3)}  Y ${(c.y / 1e6).toFixed(3)}  Z ${(c.z / 1e6).toFixed(3)} (Mkm)`;
    }
    const dx = loc.positionKm.x - c.x;
    const dy = loc.positionKm.y - c.y;
    const dz = loc.positionKm.z - c.z;
    const dist = Math.hypot(dx, dy, dz);
    return `ΔX ${dx.toFixed(0)}  ΔY ${dy.toFixed(0)}  ΔZ ${dz.toFixed(0)} km  |  R ${dist.toFixed(0)} km`;
  });

  protected shipModelLine = computed(() => this.shipSample()?.modelAssetPath ?? null);
  protected shipDesignationLine = computed(() => this.shipSample()?.displayName ?? null);
  protected hasKinematics = computed(() => !!this.asteroidSample()?.revealedKinematics);
  protected hasLocation = computed(() => !!this.asteroidSample()?.solarSystemLocation);

  protected toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }
}
