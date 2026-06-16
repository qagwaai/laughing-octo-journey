import { describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';

import { createMockSessionService } from '../../../testing';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { OPENING_STAGE_TIMINGS_MS } from '../../model/opening-sequence';
import { MissionService } from '../../services/mission.service';
import { MissionNavigationService } from '../../services/mission-navigation';
import { OpeningAudioService } from '../../services/opening-audio.service';
import { SessionService } from '../../services/session.service';
import ColdBootOpeningPage from './cold-boot';

interface NavigationState {
  playerName?: string;
  joinCharacter?: { id: string; characterName?: string };
}

const createMockOpeningAudio = (overrides?: Partial<Record<string, any>>) => ({
  isAudioHooksEnabled: vi.fn().mockReturnValue(false),
  isArmed: vi.fn().mockReturnValue(false),
  stopCinematicBed: vi.fn(),
  startCinematicBed: vi.fn().mockReturnValue(false),
  playBlackoutPulse: vi.fn(),
  playHudFlicker: vi.fn(),
  playAiAwakening: vi.fn(),
  playAiTransmissionLine: vi.fn(),
  ...overrides,
});

const mockActivatedRoute = {
  snapshot: { queryParamMap: { get: () => null } },
};

function setup(state?: NavigationState, options?: { openingAudio?: ReturnType<typeof createMockOpeningAudio> }) {
  const mockOpeningAudio = options?.openingAudio ?? createMockOpeningAudio();
  const mockRouter = {
    getCurrentNavigation: () => (state ? { extras: { state } } : null),
    navigate: vi.fn().mockResolvedValue(true),
  };
  const mockMission = {
    listMissions: vi.fn().mockImplementation(async () => []),
    upsertMissionStatus: vi.fn().mockResolvedValue('updated'),
    ensureMissionExists: vi.fn().mockResolvedValue('already-exists'),
    isMissionInProgress: vi.fn().mockImplementation((status?: string | null) => status === 'ACTIVE'),
    getMissionDamagePreset: vi.fn().mockReturnValue(null),
  };
  const mockSession = createMockSessionService('session-key');
  const mockMissionNavigation = {
    prepareNavigation: vi.fn().mockImplementation(async (context: any) => ({
      playerName: context.playerName,
      joinCharacter: context.joinCharacter,
      joinShip: { id: 'real-ship-1', name: 'Nomad', model: 'Scavenger Pod', tier: 1, status: 'active' },
      missionContext: {
        missionId: FIRST_TARGET_MISSION_ID,
        ...(context.missionStatus ? { missionStatusHint: context.missionStatus } : {}),
        seedPolicy: 'auto',
        shipDamagePreset: 'cold-boot-starter-damaged',
      },
    })),
  };

  TestBed.configureTestingModule({
    imports: [ColdBootOpeningPage],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: OpeningAudioService, useValue: mockOpeningAudio },
      { provide: MissionService, useValue: mockMission },
      { provide: MissionNavigationService, useValue: mockMissionNavigation },
      { provide: SessionService, useValue: mockSession },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(ColdBootOpeningPage);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    fixture,
    mockRouter,
    mockMission,
    mockSession,
    mockMissionNavigation,
    mockOpeningAudio,
  };
}

describe('ColdBootOpeningPage', () => {
  it('should expose opening sequence title', () => {
    const { component } = setup();
    expect(component['content']().sequenceTitle).toBe('Opening Sequence: Cold Boot');
  });

  it('should list blackout system checks in order', () => {
    const { component } = setup();
    expect(component['content']().systemChecks).toEqual([
      'BIOS CHECK... OK',
      'OXYGEN LEVELS... 18% (CRITICAL)',
      'NEURAL LINK... ESTABLISHED',
    ]);
  });

  it('should include critical oxygen warning in checks', () => {
    const { component } = setup();
    expect(component['content']().systemChecks[1]).toContain('CRITICAL');
  });

  it('should include expendable unit authorization in AI transmission', () => {
    const { component } = setup();
    expect(component['content']().aiTransmission).toContain('Deployment of the last Expendable unit is authorized.');
  });

  it('should stop cinematic bed when audio hooks are disabled', () => {
    const { component, mockOpeningAudio } = setup();

    expect(mockOpeningAudio.stopCinematicBed).toHaveBeenCalled();
    expect(component['audioEnabled']()).toBe(false);
    expect(component['audioBedRunning']()).toBe(false);
  });

  it('should keep cinematic bed stopped when hooks are enabled but audio is not armed', () => {
    const openingAudio = createMockOpeningAudio({
      isAudioHooksEnabled: vi.fn().mockReturnValue(true),
      isArmed: vi.fn().mockReturnValue(false),
    });

    const { component } = setup(undefined, { openingAudio });

    expect(component['audioEnabled']()).toBe(true);
    expect(component['audioBedRunning']()).toBe(false);
    expect(openingAudio.startCinematicBed).not.toHaveBeenCalled();
  });

  it('should start cinematic bed and trigger first blackout pulse once when armed', () => {
    const openingAudio = createMockOpeningAudio({
      isAudioHooksEnabled: vi.fn().mockReturnValue(true),
      isArmed: vi.fn().mockReturnValue(true),
      startCinematicBed: vi.fn().mockReturnValue(true),
    });

    const { component } = setup(undefined, { openingAudio });

    expect(component['audioEnabled']()).toBe(true);
    expect(component['audioBedRunning']()).toBe(true);
    expect(openingAudio.startCinematicBed).toHaveBeenCalledTimes(1);
    expect(openingAudio.playBlackoutPulse).toHaveBeenCalledTimes(1);
  });

  it('should reveal checks progressively by stage', () => {
    const { component } = setup();

    component['stage'].set(0);
    expect(component['visibleSystemChecks']().length).toBe(0);

    component['stage'].set(1);
    expect(component['visibleSystemChecks']()).toEqual(['BIOS CHECK... OK']);

    component['stage'].set(2);
    expect(component['visibleSystemChecks']().length).toBe(2);

    component['stage'].set(3);
    expect(component['visibleSystemChecks']().length).toBe(3);
  });

  it('should not start mission automatically on init', () => {
    const { mockMission } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
    });
    // ngOnInit is called by fixture.detectChanges() in setup(); it only schedules timers
    expect(mockMission.upsertMissionStatus.mock.calls.length).toBe(0);
  });

  it('should advance timed stages and play stage cues when audio is enabled', () => {
    vi.useFakeTimers();
    try {
      const openingAudio = createMockOpeningAudio({
        isAudioHooksEnabled: vi.fn().mockReturnValue(true),
        isArmed: vi.fn().mockReturnValue(true),
        startCinematicBed: vi.fn().mockReturnValue(true),
      });

      const { component } = setup(undefined, { openingAudio });
      const initialBlackoutCalls = openingAudio.playBlackoutPulse.mock.calls.length;

      vi.advanceTimersByTime(OPENING_STAGE_TIMINGS_MS.aiReveal + 10);

      expect(component['stage']()).toBe(3);
      expect(openingAudio.playBlackoutPulse.mock.calls.length).toBeGreaterThan(initialBlackoutCalls);
      expect(openingAudio.playHudFlicker).toHaveBeenCalledTimes(1);
      expect(openingAudio.playAiAwakening).toHaveBeenCalledTimes(1);
      expect(openingAudio.playAiTransmissionLine).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should stop bed and clear scheduled timers on destroy', () => {
    vi.useFakeTimers();
    try {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const openingAudio = createMockOpeningAudio({
        isAudioHooksEnabled: vi.fn().mockReturnValue(true),
        isArmed: vi.fn().mockReturnValue(true),
        startCinematicBed: vi.fn().mockReturnValue(true),
      });
      const { component } = setup(undefined, { openingAudio });

      component.ngOnDestroy();

      expect(openingAudio.stopCinematicBed).toHaveBeenCalled();
      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(component['audioBedRunning']()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should start first mission and navigate to scanning pane when requested', async () => {
    const { component, mockMission, mockSession, mockRouter, mockMissionNavigation } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1', characterName: 'Nova' },
    });

    await component['startScanning']();

    expect(mockMission.upsertMissionStatus).toHaveBeenCalledWith({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-key',
      missionId: FIRST_TARGET_MISSION_ID,
      status: 'active',
    });
    expect(mockMissionNavigation.prepareNavigation).toHaveBeenCalledWith({
      missionId: FIRST_TARGET_MISSION_ID,
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1', characterName: 'Nova' },
      sessionKey: 'session-key',
      missionStatus: 'active',
    });
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['ship-exterior-view'], right: ['opening-cold-boot-scan'], left: ['game-main'] } }],
      expect.objectContaining({
        preserveFragment: true,
        state: expect.objectContaining({
          playerName: 'Pioneer',
          joinCharacter: { id: 'char-1', characterName: 'Nova' },
          joinShip: expect.objectContaining({ id: 'real-ship-1' }),
          missionContext: {
            missionId: FIRST_TARGET_MISSION_ID,
            missionStatusHint: 'active',
            seedPolicy: 'auto',
            shipDamagePreset: 'cold-boot-starter-damaged',
          },
        }),
      }),
    );
    expect(component['scanActionError']()).toBe('');
    expect(component['scanActionPending']()).toBe(false);
  });

  it('should surface an error when mission start context is missing', async () => {
    const { component, mockMission, mockSession } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
    });
    mockSession.setSessionKey('');

    await component['startScanning']();

    expect(mockMission.upsertMissionStatus).not.toHaveBeenCalled();
    expect(mockSession.activeShip()).toBeNull();
    expect(component['scanActionError']()).toBe('Scanning handoff failed. Retry after comms stabilize.');
  });

  it('should ignore scanning requests while a scan action is already pending', async () => {
    const { component, mockMission } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
    });
    component['scanActionPending'].set(true);

    await component['startScanning']();

    expect(mockMission.upsertMissionStatus).not.toHaveBeenCalled();
  });

  it('should surface an error when mission status update fails', async () => {
    const { component, mockMission, mockSession, mockRouter } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1', characterName: 'Nova' },
    });
    mockMission.upsertMissionStatus.mockResolvedValue('update-failed');

    await component['startScanning']();

    expect(mockSession.activeShip()).toBeNull();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component['scanActionError']()).toBe('Scanning handoff failed. Retry after comms stabilize.');
    expect(component['scanActionPending']()).toBe(false);
  });
});
