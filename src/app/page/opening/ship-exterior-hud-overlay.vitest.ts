import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import ShipExteriorHudOverlayComponent from './ship-exterior-hud-overlay';

function setup() {
  TestBed.configureTestingModule({
    imports: [ShipExteriorHudOverlayComponent],
  });

  const fixture = TestBed.createComponent(ShipExteriorHudOverlayComponent);
  const component = fixture.componentInstance;

  component.objectivePanel = {
    shipConditionLine: 'SHIP CONDITION // NOMINAL',
    missionObjectiveText: 'Objective ready.',
  };
  component.flightPanel = {
    enabled: false,
    pointerLocked: false,
    invertY: false,
    sensitivitySlider: 23,
    statusLine: 'FLIGHT // OFF',
    coordsLine: 'COORD KM // ---',
    speedLine: 'SPD // 0 km/s',
    controlLine: 'W/S FWD-BACK',
    viewDirectionLine: 'VIEW // YAW 0.0° PITCH 0.0°',
    movementVectorsLine: 'MOVE // FWD(0,0,-1)',
    framePressureLine: 'FRAME PRESSURE // 0.00 ms',
    qualityScalerLine: 'QUALITY SCALER // 100%',
  };
  component.propertiesPanel = {
    showPanel: false,
    showReveal: false,
    showAsteroidProperties: false,
    showDebrisProperties: false,
    showTractorBeamCapabilityDetails: false,
    panelTitle: 'ASTEROID // PROPERTIES',
    asteroid: {
      materialText: 'MATERIAL: UNKNOWN',
      rarityText: 'RARITY: UNKNOWN',
      velocityText: 'VEL: ---',
      spinText: 'SPIN: ---',
      massText: 'MASS: ---',
      diameterText: 'DIAM: ---',
      locationText: 'LOC(Mkm): ---',
      clusterText: 'CLUSTER(Mkm): ---',
      offsetText: 'OFFSET(km): ---',
    },
    debris: {
      itemTypeText: 'ITEM TYPE: UNKNOWN',
      nameText: 'NAME: UNKNOWN',
      positionText: 'POS KM: ---',
      distanceText: 'DIST KM: ---',
      stateText: 'STATE: ---',
      tractorBeamCapabilityText: 'TRACTOR EQ: UNAVAILABLE',
      tractorBeamTimingText: 'TRACTOR PULL: ---',
    },
  };
  component.launchPanel = {
    hotkeySlots: [
      { hotkey: 1, item: null, label: 'iron', enabled: true, launching: false },
      { hotkey: 2, item: null, label: 'empty', enabled: false, launching: false },
      { hotkey: 3, item: null, label: 'empty', enabled: false, launching: false },
      { hotkey: 4, item: null, label: 'empty', enabled: false, launching: false },
      { hotkey: 5, item: null, label: 'empty', enabled: false, launching: false },
    ],
    launchInventoryDebugLine: 'INV DBG',
    launchIdentityDebugLine: 'ID DBG',
    socketCorrelationDebugLine: 'SOCKET DBG',
    socketContractViolationCounterLine: 'VIOLATION 0',
    showQuickTargetIronControl: true,
    activeLaunchToast: {
      message: 'Launch request sent.',
      tone: 'success',
      seed: 7,
    },
  };
  component.debugPanel = {
    showAnyTag: true,
    showAsteroidTag: true,
    asteroidHeaderText: 'ASTEROID DEBUG // SAMPLE',
    asteroidMaterialText: 'MAT // IRON',
    asteroidPbrText: 'PBR // OK',
    asteroidDetailRuleText: 'DETAIL // HIGH',
    asteroidTierText: 'TIER // 2',
    asteroidSw13SeedText: 'SW13 SEED // 1',
    asteroidSw13TierText: 'SW13 TIER // 2',
    asteroidSw13GeneratorText: 'SW13 GEN // A',
    asteroidSw13BundleHashText: 'SW13 BUNDLE // HASH',
    asteroidSw13ProfilePresetText: 'SW13 PROFILE // PRESET',
    asteroidSw13SurfacesText: 'SW13 SURFACES // 6',
    asteroidSw13ValidationText: 'SW13 VALIDATION // OK',
    asteroidSw13ParitySummaryText: 'SW13 PARITY // OK',
    debrisHeaderText: 'DEBRIS DEBUG // SAMPLE',
    debrisDisplayNameText: 'NAME // DRIFT',
    debrisPositionText: 'POS KM // 1,2,3',
  };

  fixture.detectChanges();

  return { fixture, component };
}

describe('ShipExteriorHudOverlayComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the core HUD sections', () => {
    const { fixture } = setup();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('SHIP CONDITION // NOMINAL');
    expect(text).toContain('FLIGHT // OFF');
    expect(text).toContain('INV DBG');
    expect(text).toContain('Launch request sent.');
  });

  it('emits HUD actions from the overlay controls', () => {
    const { fixture } = setup();
    const component = fixture.componentInstance;
    const emitted: Array<string | number | boolean> = [];

    component.toggleFlightMode.subscribe(() => emitted.push('toggle-flight'));
    component.flightInvertYChange.subscribe((value) => emitted.push(value));
    component.flightSensitivityInput.subscribe((value) => emitted.push(value));
    component.launchFromHotkeySlot.subscribe((value) => emitted.push(value));
    component.quickTargetIronAsteroidForTest.subscribe(() => emitted.push('target-iron'));
    component.scanAllAsteroidsToHeroForTest.subscribe(() => emitted.push('scan-all'));
    component.hidePropertiesPanel.subscribe(() => emitted.push('hide-properties'));

    const flightToggle = fixture.nativeElement.querySelector('.ship-exterior-flight-panel__toggle') as HTMLButtonElement;
    const targetIron = fixture.nativeElement.querySelectorAll('.ship-exterior-test-target-button')[0] as HTMLButtonElement;
    const scanAll = fixture.nativeElement.querySelectorAll('.ship-exterior-test-target-button')[1] as HTMLButtonElement;
    const hotkeyTile = fixture.nativeElement.querySelector('.ship-exterior-hotkey-tile') as HTMLButtonElement;

    flightToggle.click();
    targetIron.click();
    scanAll.click();
    hotkeyTile.click();

    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const range = fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;
    range.value = '41';
    range.dispatchEvent(new Event('input'));

    expect(emitted).toContain('toggle-flight');
    expect(emitted).toContain(1);
    expect(emitted).toContain('target-iron');
    expect(emitted).toContain('scan-all');
    expect(emitted).toContain(true);
    expect(emitted).toContain(41);
  });

  it('toggles debug collapse inside the overlay', () => {
    const { fixture } = setup();

    expect(fixture.nativeElement.textContent).toContain('MAT // IRON');

    const toggle = fixture.nativeElement.querySelector('.ship-exterior-asteroid-debug__toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('SHOW');
    expect(text).not.toContain('MAT // IRON');
  });
});