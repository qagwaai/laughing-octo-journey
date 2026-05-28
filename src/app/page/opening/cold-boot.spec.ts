import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';

import { createMockMissionService, createMockSessionService } from '../../../testing';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { MissionService } from '../../services/mission.service';
import { MissionNavigationService } from '../../services/mission-navigation';
import { OpeningAudioService } from '../../services/opening-audio.service';
import { SessionService } from '../../services/session.service';
import ColdBootOpeningPage from './cold-boot';

interface NavigationState {
  playerName?: string;
  joinCharacter?: { id: string; characterName?: string };
}

const mockOpeningAudio = {
  isAudioHooksEnabled: () => false,
  isArmed: () => false,
  stopCinematicBed: () => {},
  startCinematicBed: () => false,
  playBlackoutPulse: () => {},
  playHudFlicker: () => {},
  playAiAwakening: () => {},
  playAiTransmissionLine: () => {},
};

const mockActivatedRoute = {
  snapshot: { queryParamMap: { get: () => null } },
};

function setup(state?: NavigationState) {
  const mockRouter = {
    getCurrentNavigation: () => (state ? { extras: { state } } : null),
    navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
  };
  const mockMission = createMockMissionService();
  const mockSession = createMockSessionService('session-key');
  const mockMissionNavigation = {
    prepareNavigation: jasmine.createSpy('prepareNavigation').and.callFake(async (context: any) => ({
      playerName: context.playerName,
      joinCharacter: context.joinCharacter,
      joinShip: { id: 'real-ship-1', name: 'Nomad', model: 'Scavenger Pod', tier: 1, status: 'ACTIVE' },
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
  return { component: fixture.componentInstance, fixture, mockRouter, mockMission, mockSession, mockMissionNavigation };
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
    expect(mockMission.upsertMissionStatus.calls.count()).toBe(0);
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
      status: 'ACTIVE',
    });
    expect(mockMissionNavigation.prepareNavigation).toHaveBeenCalledWith({
      missionId: FIRST_TARGET_MISSION_ID,
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1', characterName: 'Nova' },
      sessionKey: 'session-key',
      missionStatus: 'ACTIVE',
    });
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { right: ['opening-cold-boot-scan'], left: ['game-main'] } }],
      jasmine.objectContaining({
        preserveFragment: true,
        state: jasmine.objectContaining({
          playerName: 'Pioneer',
          joinCharacter: { id: 'char-1', characterName: 'Nova' },
          joinShip: jasmine.objectContaining({ id: 'real-ship-1' }),
          missionContext: {
            missionId: FIRST_TARGET_MISSION_ID,
            missionStatusHint: 'ACTIVE',
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

  it('should surface an error when mission status update fails', async () => {
    const { component, mockMission, mockSession, mockRouter } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1', characterName: 'Nova' },
    });
    mockMission.upsertMissionStatus.and.resolveTo('update-failed');

    await component['startScanning']();

    expect(mockSession.activeShip()).toBeNull();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component['scanActionError']()).toBe('Scanning handoff failed. Retry after comms stabilize.');
    expect(component['scanActionPending']()).toBe(false);
  });
});
