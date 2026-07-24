import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { ShipExteriorViewStateService } from '../../services/ship-exterior-view-state.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { ShipSummary } from '../../model/ship-list';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { ShipListByOwnerRequest } from '../../model/ship-list-by-owner';
import { ShipSceneContext } from './ship-scene-context';
import { ShipExteriorInputAdapter } from './ship-exterior-input-adapter';
import { ShipSceneRegistry } from './ship-scene-registry';
import { buildShipSceneContextKey, ShipSceneContextState } from './ship-scene-types';
import {
  createInitialMissionGateState,
  resolveShipExteriorMission,
  type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import {
  registerShipExteriorBareSceneTestApi,
  unregisterShipExteriorBareSceneTestApi,
} from './ship-exterior-bare-scene-test-api';

export function shouldToggleFlightModeFromKey(code: string, flightModeEnabled: boolean): boolean {
  return code === 'KeyF' || (code === 'Escape' && flightModeEnabled);
}

@Component({
  selector: 'app-ship-exterior-bare-scene',
  standalone: true,
  templateUrl: './ship-exterior-bare-scene.component.html',
  styleUrls: ['./ship-exterior-bare-scene.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShipExteriorBareSceneComponent implements OnInit, AfterViewInit, OnDestroy {
  private static readonly OBJECTIVE_UNLOCKED_MESSAGE =
    'Objective unlocked: Neutralize the identified asteroid using a launchable payload.';
  private static readonly TEST_TARGET_HOLD_MS = 2500;

  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly shipService = inject(ShipService);
  private readonly shipExteriorViewStateService = inject(ShipExteriorViewStateService);
  private readonly missionStateService = inject(ShipExteriorMissionStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canvasHost = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');
  readonly contexts = signal<ShipSceneContext[]>([]);
  readonly activeContextKey = signal<string | null>(null);
  readonly contextKeys = computed(() => this.contexts().map((context) => context.contextKey));
  readonly activeStarfieldSignature = computed(() => {
    const key = this.activeContextKey();
    if (!key) {
      return null;
    }

    return this.registry.getContext(key)?.getStarfieldSignature() ?? null;
  });
  readonly activeFlightSnapshot = computed(() => {
    this.runtimeRevision();
    this.activeContextKey();
    return this.registry.getActiveContext()?.snapshotRuntime() ?? null;
  });
  readonly activeFlightStatusLine = computed(
    () => `FLIGHT // ${this.activeFlightSnapshot()?.flightModeEnabled ? 'ON' : 'OFF'}`,
  );
  readonly activeFlightCoordsLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    if (!snapshot) {
      return 'COORD KM // ---';
    }

    const location = snapshot.flightCurrentLocationKm;
    return `COORD KM // ${location.x.toFixed(2)}, ${location.y.toFixed(2)}, ${location.z.toFixed(2)}`;
  });
  readonly activeFlightSpeedLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    if (!snapshot) {
      return 'SPD // 0.00 km/s';
    }

    return `SPD // ${snapshot.flightSpeedKmPerSec.toFixed(2)} km/s`;
  });
  readonly activeFlightDirectionLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    if (!snapshot) {
      return 'VIEW // YAW 0.0° PITCH 0.0°';
    }

    const context = this.registry.getActiveContext();
    const flight = context?.getState().flight;
    const orientation = flight?.orientation ?? { yawRad: 0, pitchRad: 0 };
    return `VIEW // YAW ${(orientation.yawRad * 57.2958).toFixed(1)}° PITCH ${(orientation.pitchRad * 57.2958).toFixed(1)}°`;
  });
  readonly activeFlightMovementLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    if (!snapshot) {
      return 'MOVE // OFF';
    }

    const offset = snapshot.flightWorldOffset;
    return `MOVE // OFFSET(${offset.x.toFixed(2)},${offset.y.toFixed(2)},${offset.z.toFixed(2)})`;
  });
  readonly activeFlightFramePressureLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    return `FRAME PRESSURE // ${(snapshot?.renderedFrameCount ?? 0).toFixed(0)} FRAMES`;
  });
  readonly activeFlightQualityScalerLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    return `QUALITY SCALER // ${snapshot?.isPaused ? 'PAUSED' : 'ACTIVE'}`;
  });
  readonly objectiveMessage = signal<string>(ShipExteriorBareSceneComponent.OBJECTIVE_UNLOCKED_MESSAGE);
  readonly activeLaunchToast = signal<{ message: string; tone: 'success' | 'error' } | null>(null);

  private readonly registry = new ShipSceneRegistry();
  private readonly inputAdapter = new ShipExteriorInputAdapter(
    {
      onWindowPointerDown: (event) => this.onWindowPointerDown(event),
      onWindowPointerUp: (event) => this.onWindowPointerUp(event),
      onWindowContextMenu: (event) => this.onWindowContextMenu(event),
      onWindowKeyDown: (event) => this.onWindowKeyDown(event),
      onWindowKeyUp: (event) => this.onWindowKeyUp(event),
      onWindowMouseMove: (event) => this.onWindowMouseMove(event),
      onSocketCorrelationWarning: (event) => this.onSocketCorrelationWarning(event),
      onPointerLockChange: () => this.onPointerLockChange(),
    },
    window,
    document,
  );
  private readonly asteroidSamples = signal([
    {
      id: 'sample-iron-1',
      scanned: false,
      scanProgress: 0,
      revealedMaterial: { material: 'Iron', rarity: 'Common' },
    },
  ]);
  readonly targetedAsteroidId = signal<string | null>(null);
  private readonly testTargetHoldCandidateId = signal<string | null>(null);
  private testTargetHoldTimeoutId: number | null = null;
  private readonly missionGateState = signal<ShipExteriorMissionGateState>(
    createInitialMissionGateState({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId: 'unknown-character',
      steps: resolveShipExteriorMission(FIRST_TARGET_MISSION_ID).getGateStepDefinitions(),
    }),
  );
  private readonly testInventoryRewards = signal<string[]>([]);
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private viewReady = false;
  private hasBootstrappedContexts = false;
  private readonly runtimeRevision = signal(0);
  private readonly navigationPlayerName = signal<string>('unknown-player');
  private readonly navigationCharacterId = signal<string>('unknown-character');

  ngOnInit(): void {
    this.resolveNavigationIdentity();
    this.initializeMissionGateStateForTestApi();
    this.bootstrapContexts();
    this.inputAdapter.attach();
    this.registerTestApi();

    this.destroyRef.onDestroy(() => {
      this.inputAdapter.detach();
      unregisterShipExteriorBareSceneTestApi();
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.attachVisibleCanvas();
    this.observeResize();
    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.resizeObserver?.disconnect();
    this.clearTestTargetHoldTimer();
    this.teardownAllContexts();
  }

  activateContext(contextKey: string): boolean {
    const activated = this.registry.activate(contextKey);
    if (!activated) {
      return false;
    }

    this.activeContextKey.set(contextKey);
    const activeState = this.registry.getActiveContext()?.getState();
    if (activeState) {
      this.shipExteriorViewStateService.saveCurrentContext({
        playerName: activeState.playerName,
        characterId: activeState.characterId,
        shipId: activeState.shipId,
      });
    }
    this.attachVisibleCanvas();
    this.logContextActivation(contextKey);
    this.bumpRuntimeRevision();
    return true;
  }

  toggleFlightMode(): void {
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    active.toggleFlightMode();
    this.syncPointerLockForActiveContext(false);
    this.logContextActivation(active.contextKey);
    this.bumpRuntimeRevision();
  }

  setFlightInvertY(enabled: boolean): void {
    const active = this.registry.getActiveContext();
    active?.setFlightInvertY(enabled);
    this.bumpRuntimeRevision();
  }

  setFlightMouseSensitivityFromSliderValue(rawValue: number): void {
    const active = this.registry.getActiveContext();
    active?.setFlightMouseSensitivityFromSliderValue(rawValue);
    this.bumpRuntimeRevision();
  }

  selectFirstScannedIronTargetForTest(): void {
    const sample = this.asteroidSamples().find(
      (candidate) => candidate.scanned && candidate.revealedMaterial?.material?.toLowerCase() === 'iron',
    );

    if (sample) {
      this.targetedAsteroidId.set(sample.id);
      return;
    }

    const first = this.asteroidSamples()[0];
    if (first) {
      this.targetedAsteroidId.set(first.id);
    }
  }

  snapshotActiveContext(): ReturnType<ShipSceneContext['snapshotRuntime']> {
    return this.registry.getActiveContext()?.snapshotRuntime() ?? null;
  }

  private readonly onSessionActiveShipChange = effect(() => {
    const activeShip = this.sessionService.activeShip();
    if (!activeShip?.id?.trim()) {
      return;
    }

    const playerName = this.navigationPlayerName();
    const characterId = this.navigationCharacterId();

    this.upsertContextFromShip(activeShip, playerName, characterId);
    const contextKey = buildShipSceneContextKey({
      playerName,
      characterId,
      shipId: activeShip.id,
    });

    this.activateContext(contextKey);
  });

  private readonly onSessionReset = effect(() => {
    if (!this.hasBootstrappedContexts) {
      return;
    }

    const activeShip = this.sessionService.activeShip();
    const activeCharacter = this.sessionService.activeCharacter();

    if (activeShip || activeCharacter) {
      return;
    }

    this.teardownAllContexts();
  });

  private bootstrapContexts(): void {
    const initialShip = this.sessionService.activeShip();
    const activeCharacterId = this.navigationCharacterId();
    const playerName = this.navigationPlayerName();

    if (initialShip) {
      this.upsertContextFromShip(initialShip, playerName, activeCharacterId);
    }

    const sessionKey = this.sessionService.getSessionKey();
    if (!sessionKey || !playerName || !activeCharacterId || activeCharacterId === 'unknown-character') {
      this.ensureFallbackContexts(playerName, activeCharacterId);
      this.activateFirstContextIfNeeded();
      return;
    }

    const request: ShipListByOwnerRequest = {
      playerName,
      sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId: activeCharacterId,
      },
    };

    this.shipService.listShipsByOwner(request, (response) => {
      response.ships.forEach((ship) => this.upsertContextFromShip(ship, playerName, activeCharacterId));
      this.ensureFallbackContexts(playerName, activeCharacterId);
      this.syncContextsSignal();
      this.activateFirstContextIfNeeded();
      this.attachVisibleCanvas();
    });

    this.syncContextsSignal();
    this.activateFirstContextIfNeeded();
  }

  private resolveNavigationIdentity(): void {
    const navigationState = (this.router.getCurrentNavigation()?.extras.state ?? window.history.state) as
      | { playerName?: unknown; joinCharacter?: { id?: unknown } }
      | undefined;

    const playerName = typeof navigationState?.playerName === 'string' ? navigationState.playerName.trim() : '';
    const characterId =
      typeof navigationState?.joinCharacter?.id === 'string' ? navigationState.joinCharacter.id.trim() : '';

    this.navigationPlayerName.set(playerName || 'unknown-player');
    this.navigationCharacterId.set(
      characterId || this.sessionService.activeCharacter()?.id?.trim() || 'unknown-character',
    );

    this.shipExteriorViewStateService.saveCurrentContext({
      playerName: this.navigationPlayerName(),
      characterId: this.navigationCharacterId(),
      shipId: this.sessionService.activeShip()?.id?.trim() || 'unknown-ship',
    });
  }

  private onWindowPointerDown(_event: PointerEvent): void {
    this.syncPointerLockForActiveContext(true);
  }

  private onWindowPointerUp(_event: PointerEvent): void {}

  private onWindowContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  private onWindowKeyDown(event: KeyboardEvent): void {
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    if (shouldToggleFlightModeFromKey(event.code, active.flightModeEnabled())) {
      this.toggleFlightMode();
      event.preventDefault();
      return;
    }

    if (active.captureFlightMovementKey(event.code)) {
      event.preventDefault();
    }
  }

  private onWindowKeyUp(event: KeyboardEvent): void {
    this.registry.getActiveContext()?.releaseFlightMovementKey(event.code);
  }

  private onWindowMouseMove(event: MouseEvent): void {
    const active = this.registry.getActiveContext();
    if (!active?.flightModeEnabled()) {
      return;
    }

    active.applyFlightMouseMove(event.movementX, event.movementY);
  }

  private onSocketCorrelationWarning(_event: Event): void {}

  private onPointerLockChange(): void {
    this.syncPointerLockForActiveContext(false);
    this.bumpRuntimeRevision();
  }

  private syncPointerLockForActiveContext(allowRequest: boolean): void {
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    const rendering = active.getRenderingState();
    if (!rendering) {
      return;
    }

    if (active.flightModeEnabled()) {
      if (!allowRequest) {
        return;
      }

      if (typeof rendering.canvas.requestPointerLock === 'function' && document.pointerLockElement !== rendering.canvas) {
        rendering.canvas.requestPointerLock();
      }
      return;
    }

    if (document.pointerLockElement === rendering.canvas && typeof document.exitPointerLock === 'function') {
      document.exitPointerLock();
    }
  }

  private upsertContextFromShip(ship: ShipSummary, playerName: string, characterId: string): void {
    const shipId = ship.id?.trim();
    if (!shipId) {
      return;
    }

    const initialState: ShipSceneContextState = {
      playerName,
      characterId,
      shipId,
      world: {
        shipPosition: {
          x: ship.spatial?.positionKm?.x ?? 0,
          y: ship.spatial?.positionKm?.y ?? 0,
          z: ship.spatial?.positionKm?.z ?? 0,
        },
      },
    };

    const contextKey = buildShipSceneContextKey({ playerName, characterId, shipId });
    const context = this.registry.getOrCreateContext(contextKey, initialState);
    context.setState(initialState);
    this.syncContextsSignal();
  }

  private ensureFallbackContexts(playerName: string, characterId: string): void {
    if (this.registry.getAllContexts().length >= 2) {
      return;
    }

    const fallbackIds = ['fallback-ship-a', 'fallback-ship-b'];
    for (const shipId of fallbackIds) {
      const contextKey = buildShipSceneContextKey({ playerName, characterId, shipId });
      this.registry.getOrCreateContext(contextKey, {
        playerName,
        characterId,
        shipId,
        world: {
          shipPosition: { x: shipId.endsWith('a') ? -1 : 1.25, y: 0, z: 0 },
        },
      });
    }

    this.syncContextsSignal();
  }

  private syncContextsSignal(): void {
    const contexts = this.registry.getAllContexts();
    this.contexts.set(contexts);
    if (contexts.length > 0) {
      this.hasBootstrappedContexts = true;
    }
  }

  private activateFirstContextIfNeeded(): void {
    if (this.activeContextKey()) {
      return;
    }

    const first = this.registry.getAllContexts()[0];
    if (!first) {
      return;
    }

    this.activateContext(first.contextKey);
  }

  private attachVisibleCanvas(): void {
    if (!this.viewReady) {
      return;
    }

    const host = this.canvasHost().nativeElement;
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    this.registry.getAllContexts().forEach((context) => {
      const rendering = context.getRenderingState();
      if (!rendering) {
        return;
      }

      if (!host.contains(rendering.canvas)) {
        host.appendChild(rendering.canvas);
      }

      rendering.canvas.style.display = context.contextKey === active.contextKey ? 'block' : 'none';
      if (context.contextKey === active.contextKey) {
        context.setViewport(host.clientWidth, host.clientHeight);
      }
    });

    if (!active.getRenderingState()) {
      const rendering = active.initializeRendering();
      host.appendChild(rendering.canvas);
      rendering.canvas.style.display = 'block';
      active.setViewport(host.clientWidth, host.clientHeight);
      active.resume();
    }
  }

  private observeResize(): void {
    const host = this.canvasHost().nativeElement;
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      this.registry.getAllContexts().forEach((context) => context.setViewport(width, height));
    });

    this.resizeObserver.observe(host);
  }

  private startAnimationLoop(): void {
    const loop = () => {
      this.registry.enforceActivePauseInvariants();
      const active = this.registry.getActiveContext();
      active?.renderFrame();
      if (active) {
        this.bumpRuntimeRevision();
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private logContextActivation(contextKey: string): void {
    if (typeof console === 'undefined') {
      return;
    }

    const active = this.registry.getActiveContext();
    const state = active?.getState();
    const contextSummary = this.registry.getAllContexts().map((context) => ({
      contextKey: context.contextKey,
      shipId: context.getState().shipId,
      starfieldSignature: context.getStarfieldSignature(),
      paused: context.isPaused(),
      renderedFrameCount: context.getRenderedFrameCount(),
    }));

    console.log('[ship-exterior] active context switched', {
      contextKey,
      shipId: state?.shipId ?? null,
      playerName: state?.playerName ?? null,
      characterId: state?.characterId ?? null,
      totalContexts: this.registry.getAllContexts().length,
      activeStarfieldSignature: active?.getStarfieldSignature() ?? null,
      flightModeEnabled: active?.flightModeEnabled() ?? false,
      flightPointerLocked: active?.flightPointerLocked() ?? false,
      contexts: contextSummary,
    });
  }

  private teardownAllContexts(): void {
    this.registry.dispose();
    this.contexts.set([]);
    this.activeContextKey.set(null);
    this.hasBootstrappedContexts = false;

    if (!this.viewReady) {
      return;
    }

    const host = this.canvasHost().nativeElement;
    host.querySelectorAll('canvas.ship-scene-canvas').forEach((node) => node.remove());
  }

  private registerTestApi(): void {
    registerShipExteriorBareSceneTestApi({
      contextKeys: this.contextKeys,
      activeContextKey: this.activeContextKey.asReadonly(),
      activateContext: (contextKey: string) => this.activateContext(contextKey),
      snapshotActiveContext: () => this.registry.getActiveContext()?.snapshotRuntime() ?? null,
      toggleFlightMode: () => this.toggleFlightMode(),
      setFlightInvertY: (enabled: boolean) => this.setFlightInvertY(enabled),
      setFlightMouseSensitivityFromSliderValue: (rawValue: number) =>
        this.setFlightMouseSensitivityFromSliderValue(rawValue),
      legacy: {
        getAsteroidSamples: () => this.asteroidSamples(),
        beginAsteroidTargetHold: (sampleId: string) => this.beginAsteroidTargetHold(sampleId),
        unhoverAsteroid: (sampleId: string) => this.unhoverAsteroid(sampleId),
        getTargetHoldCandidateId: () => this.testTargetHoldCandidateId(),
        getMissionGateState: () => this.missionGateState(),
        resetMissionGateState: () => this.resetMissionGateStateForTest(),
        forceCompleteIronScan: (sampleId?: string) => this.forceCompleteIronScan(sampleId),
        forceTargetAsteroid: (sampleId: string) => this.forceTargetAsteroid(sampleId),
        getTargetedAsteroidId: () => this.targetedAsteroidId(),
        launchFromHotkey: (hotkey: 1 | 2 | 3 | 4 | 5) => this.launchFromHotkey(hotkey),
        simulateDebrisCollection: (remainingDebrisCount?: number) => this.simulateDebrisCollection(remainingDebrisCount),
        simulateManufacture: (itemType: string) => this.simulateManufacture(itemType),
        simulateRepair: (repairKind: string) => this.simulateRepair(repairKind),
        getActiveShipInventoryItemTypes: () => this.getActiveShipInventoryItemTypes(),
        getActiveLaunchToast: () => this.activeLaunchToast(),
      },
    });
  }

  private initializeMissionGateStateForTestApi(): void {
    const playerName = this.navigationPlayerName().trim();
    const characterId = this.navigationCharacterId().trim();
    const missionId = FIRST_TARGET_MISSION_ID;

    if (!playerName || !characterId || characterId === 'unknown-character') {
      return;
    }

    const fromStorage = this.missionStateService.loadState({
      missionId,
      playerName,
      characterId,
    });

    if (fromStorage) {
      this.missionGateState.set(fromStorage);
      return;
    }

    const initialState = this.createInitialMissionGateStateForTestApi(characterId);
    this.missionGateState.set(initialState);
    this.persistMissionGateState(initialState);
  }

  private createInitialMissionGateStateForTestApi(characterId: string): ShipExteriorMissionGateState {
    const missionId = FIRST_TARGET_MISSION_ID;
    return createInitialMissionGateState({
      missionId,
      characterId,
      steps: resolveShipExteriorMission(missionId).getGateStepDefinitions(),
    });
  }

  private resetMissionGateStateForTest(): ShipExteriorMissionGateState {
    const characterId = this.navigationCharacterId().trim();
    const resetState = this.createInitialMissionGateStateForTestApi(characterId || 'unknown-character');
    this.missionGateState.set(resetState);
    this.persistMissionGateState(resetState);

    this.clearTestTargetHoldTimer();
    this.testInventoryRewards.set([]);
    this.targetedAsteroidId.set(null);
    this.asteroidSamples.update((samples) =>
      samples.map((sample) => ({
        ...sample,
        scanned: false,
        scanProgress: 0,
        revealedMaterial: { material: 'Iron', rarity: 'Common' },
      })),
    );

    return resetState;
  }

  private beginAsteroidTargetHold(sampleId: string): boolean {
    const sampleExists = this.asteroidSamples().some((sample) => sample.id === sampleId);
    if (!sampleExists) {
      return false;
    }

    this.clearTestTargetHoldTimer();
    this.testTargetHoldCandidateId.set(sampleId);
    this.testTargetHoldTimeoutId = window.setTimeout(() => {
      if (this.testTargetHoldCandidateId() === sampleId) {
        this.forceTargetAsteroid(sampleId);
      }
      this.clearTestTargetHoldTimer();
    }, ShipExteriorBareSceneComponent.TEST_TARGET_HOLD_MS);

    return true;
  }

  private unhoverAsteroid(sampleId: string): boolean {
    if (this.testTargetHoldCandidateId() !== sampleId) {
      return false;
    }

    this.clearTestTargetHoldTimer();
    return true;
  }

  private clearTestTargetHoldTimer(): void {
    if (this.testTargetHoldTimeoutId !== null) {
      clearTimeout(this.testTargetHoldTimeoutId);
      this.testTargetHoldTimeoutId = null;
    }
    this.testTargetHoldCandidateId.set(null);
  }

  private persistMissionGateState(state: ShipExteriorMissionGateState): void {
    const playerName = this.navigationPlayerName().trim();
    const characterId = this.navigationCharacterId().trim();
    if (!playerName || !characterId || characterId === 'unknown-character') {
      return;
    }

    this.missionStateService.saveState(
      {
        missionId: FIRST_TARGET_MISSION_ID,
        playerName,
        characterId,
      },
      state,
    );
  }

  private updateMissionGateState(
    updater: (state: ShipExteriorMissionGateState) => ShipExteriorMissionGateState,
  ): ShipExteriorMissionGateState {
    const nextState = updater(this.missionGateState());
    this.missionGateState.set(nextState);
    this.persistMissionGateState(nextState);
    return nextState;
  }

  private setStepStatus(
    state: ShipExteriorMissionGateState,
    key: string,
    status: 'locked' | 'active' | 'completed' | 'pending-retry',
  ): ShipExteriorMissionGateState {
    return {
      ...state,
      updatedAt: new Date().toISOString(),
      steps: state.steps.map((step) =>
        step.key === key
          ? {
              ...step,
              status,
              completedAt: status === 'completed' ? step.completedAt ?? new Date().toISOString() : step.completedAt,
            }
          : step,
      ),
    };
  }

  private bumpRuntimeRevision(): void {
    this.runtimeRevision.update((value) => value + 1);
  }

  private forceCompleteIronScan(sampleId?: string): ShipExteriorMissionGateState | null {
    const targetId = sampleId ?? this.asteroidSamples()[0]?.id;
    if (!targetId) {
      return null;
    }

    let updatedSample: {
      id: string;
      scanned: boolean;
      scanProgress: number;
      revealedMaterial: { material: string; rarity: string };
    } | null = null;

    this.asteroidSamples.update((samples) =>
      samples.map((sample) => {
        if (sample.id !== targetId) {
          return sample;
        }

        updatedSample = {
          ...sample,
          scanned: true,
          scanProgress: 100,
          revealedMaterial: { material: 'Iron', rarity: 'Common' },
        };
        return updatedSample;
      }),
    );

    if (!updatedSample) {
      return null;
    }

    return this.updateMissionGateState((state) => {
      const identifyCompleted = this.setStepStatus(state, 'identify_iron_asteroid', 'completed');
      const neutralizeActive = this.setStepStatus(identifyCompleted, 'neutralize_identified_asteroid', 'active');
      return {
        ...neutralizeActive,
        activeObjectiveText: 'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
      };
    });
  }

  private forceTargetAsteroid(sampleId: string): boolean {
    const exists = this.asteroidSamples().some((sample) => sample.id === sampleId);
    if (!exists) {
      return false;
    }

    this.targetedAsteroidId.set(sampleId);
    return true;
  }

  private launchFromHotkey(_hotkey: 1 | 2 | 3 | 4 | 5): void {
    const hasLaunchable = this.sessionService
      .activeShip()
      ?.inventory?.some((item) => item.launchable === true);

    if (!hasLaunchable) {
      this.activeLaunchToast.set({
        message: 'Cannot launch: no launchable item available in active ship inventory.',
        tone: 'error',
      });
      return;
    }

    const targetId = this.targetedAsteroidId();
    if (!targetId) {
      this.activeLaunchToast.set({ message: 'Launch queued.', tone: 'success' });
      return;
    }

    const targetSample = this.asteroidSamples().find((sample) => sample.id === targetId);
    const targetedIron = targetSample?.revealedMaterial?.material?.toLowerCase() === 'iron';

    if (targetedIron) {
      this.testInventoryRewards.update((types) => (types.includes('iron') ? types : [...types, 'iron']));

      this.updateMissionGateState((state) => {
        const neutralizeCompleted = this.setStepStatus(state, 'neutralize_identified_asteroid', 'completed');
        const manufactureActive = this.setStepStatus(neutralizeCompleted, 'manufacture_hull_patch_kit', 'active');
        return {
          ...manufactureActive,
          activeObjectiveText: 'Objective unlocked: Manufacture a Hull Patch Kit in the Fabrication Lab.',
        };
      });
    }

    this.activeLaunchToast.set({ message: 'Launch queued.', tone: 'success' });
  }

  private simulateDebrisCollection(_remainingDebrisCount?: number): ShipExteriorMissionGateState {
    return this.missionGateState();
  }

  private simulateManufacture(itemType: string): ShipExteriorMissionGateState {
    if (itemType !== 'hull-patch-kit') {
      return this.missionGateState();
    }

    const manufactureStep = this.missionGateState().steps.find((step) => step.key === 'manufacture_hull_patch_kit');
    if (manufactureStep?.status !== 'active') {
      return this.missionGateState();
    }

    return this.updateMissionGateState((state) => {
      const manufactureCompleted = this.setStepStatus(state, 'manufacture_hull_patch_kit', 'completed');
      const repairActive = this.setStepStatus(manufactureCompleted, 'repair_scavenger_pod', 'active');
      return {
        ...repairActive,
        activeObjectiveText: 'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
      };
    });
  }

  private simulateRepair(repairKind: string): ShipExteriorMissionGateState {
    if (repairKind !== 'ship') {
      return this.missionGateState();
    }

    const repairStep = this.missionGateState().steps.find((step) => step.key === 'repair_scavenger_pod');
    if (repairStep?.status !== 'active') {
      return this.missionGateState();
    }

    return this.updateMissionGateState((state) => {
      const repairCompleted = this.setStepStatus(state, 'repair_scavenger_pod', 'completed');
      return {
        ...repairCompleted,
        activeObjectiveText: 'Mission objectives complete. Await further directives.',
      };
    });
  }

  private getActiveShipInventoryItemTypes(): string[] {
    const baseTypes = this.sessionService
      .activeShip()
      ?.inventory?.map((item) => item.itemType)
      .filter((itemType): itemType is string => typeof itemType === 'string' && itemType.length > 0) ?? [];

    return [...baseTypes, ...this.testInventoryRewards()];
  }
}
