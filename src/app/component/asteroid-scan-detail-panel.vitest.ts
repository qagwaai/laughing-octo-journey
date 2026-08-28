import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AsteroidScanDetailPanel } from './asteroid-scan-detail-panel';

describe('AsteroidScanDetailPanel', () => {
  async function createFixture(): Promise<ComponentFixture<AsteroidScanDetailPanel>> {
    await TestBed.configureTestingModule({
      imports: [AsteroidScanDetailPanel],
    }).compileComponents();
    return TestBed.createComponent(AsteroidScanDetailPanel);
  }

  it('renders ship scan details and keeps asteroid-only values null for ship samples', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('sample', {
      kind: 'ship',
      sample: {
        id: 'jaxs-ship',
        displayName: 'Jax Ship',
        modelAssetPath: 'models/Jaxs_Ship_texture.glb',
        scanned: true,
        scanProgress: 100,
      },
    });
    fixture.detectChanges();

    expect((component as any).isAsteroidSample()).toBe(false);
    expect((component as any).objectLine()).toBe('SHIP');
    expect((component as any).shipDesignationLine()).toBe('Jax Ship');
    expect((component as any).profileLine()).toBe('models/Jaxs_Ship_texture.glb');
    expect((component as any).materialLine()).toBeNull();
    expect((component as any).rarityLine()).toBeNull();
    expect((component as any).hasKinematics()).toBe(false);
    expect((component as any).hasLocation()).toBe(false);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('OBJECT');
    expect(text).toContain('SHIP');
    expect(text).toContain('DESIGNATION');
    expect(text).toContain('MODEL');
    expect(text).not.toContain('MATERIAL');
  });

  it('renders debris scan details in the shared panel', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('sample', {
      kind: 'debris',
      sample: {
        id: 'debris-1',
        displayName: 'Cargo Canister',
        itemType: 'cargo-canister',
        scanned: true,
        scanProgress: 100,
      },
    });
    fixture.detectChanges();

    expect((component as any).isAsteroidSample()).toBe(false);
    expect((component as any).objectLine()).toBe('DEBRIS');
    expect((component as any).shipDesignationLine()).toBe('Cargo Canister');
    expect((component as any).profileLine()).toBe('cargo-canister');
    expect((component as any).materialLine()).toBeNull();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('OBJECT');
    expect(text).toContain('DEBRIS');
    expect(text).toContain('DESIGNATION');
    expect(text).toContain('MODEL');
  });

  it('renders asteroid scan details for asteroid samples', async () => {
    const fixture = await createFixture();
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('sample', {
      kind: 'asteroid',
      sample: {
        id: 'sample-alpha',
        scanned: true,
        scanProgress: 100,
        revealedMaterial: { material: 'Iron', rarity: 'Common' },
      },
    });
    fixture.detectChanges();

    expect((component as any).isAsteroidSample()).toBe(true);
    expect((component as any).materialLine()).toBe('Iron');
    expect((component as any).rarityLine()).toBe('Common');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('MATERIAL');
    expect(text).toContain('RARITY');
  });
});
