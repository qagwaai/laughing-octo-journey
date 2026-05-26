/**
 * Unit tests for mission initialization strategy and navigation service.
 */

import { TestBed } from '@angular/core/testing';
import { SessionService } from '../session.service';
import { ShipService } from '../ship.service';
import { MissionNavigationService, type MissionNavigationContext } from './mission-navigation.service';
import {
  registerMissionInitializationStrategy,
  resolveMissionInitializationStrategy,
  type MissionInitializationStrategy,
  type MissionInitializationParams,
} from './mission-initialization-strategy';

describe('MissionInitializationStrategy Registration', () => {
  it('should register and resolve custom strategies', () => {
    const customStrategy: MissionInitializationStrategy = {
      getMissionId: () => 'custom-mission',
      buildMissionContext: (params) => ({
        missionId: params.missionId,
        seedPolicy: 'resume',
        shipDamagePreset: 'cold-boot-starter-damaged',
      }),
      resolveDamagePreset: () => 'cold-boot-starter-damaged',
    };

    registerMissionInitializationStrategy('custom-mission', customStrategy);
    const resolved = resolveMissionInitializationStrategy('custom-mission');

    expect(resolved.getMissionId()).toBe('custom-mission');

    const context = resolved.buildMissionContext({ missionId: 'custom-mission' });
    expect(context.seedPolicy).toBe('resume');
    expect(context.shipDamagePreset).toBe('cold-boot-starter-damaged');
  });

  it('should return default strategy for unregistered missions', () => {
    const resolved = resolveMissionInitializationStrategy('unregistered-mission');

    expect(resolved).toBeDefined();
    expect(resolved.getMissionId()).toBe('unregistered-mission');

    const context = resolved.buildMissionContext({ missionId: 'unregistered-mission' });
    expect(context.missionId).toBe('unregistered-mission');
    expect(context.seedPolicy).toBe('auto');
  });

  it('should handle null mission ID with default strategy', () => {
    const resolved = resolveMissionInitializationStrategy(null);
    expect(resolved).toBeDefined();

    const context = resolved.buildMissionContext({ missionId: 'test' });
    expect(context.seedPolicy).toBe('auto');
  });

  it('should pass mission status through to context', () => {
    const testStrategy: MissionInitializationStrategy = {
      getMissionId: () => 'test-mission',
      buildMissionContext: (params) => ({
        missionId: params.missionId,
        seedPolicy: 'auto',
          ...(params.missionStatus ? { missionStatusHint: params.missionStatus } : {}),
      }),
      resolveDamagePreset: () => undefined,
    };

    registerMissionInitializationStrategy('test-mission', testStrategy);
    const resolved = resolveMissionInitializationStrategy('test-mission');

    const context = resolved.buildMissionContext({
      missionId: 'test-mission',
      missionStatus: 'in-progress',
    });

    expect(context.missionStatusHint).toBe('in-progress');
  });
});

describe('MissionNavigationService', () => {
  let service: MissionNavigationService;
  let sessionService: jasmine.SpyObj<SessionService>;
  let shipService: jasmine.SpyObj<ShipService>;

  beforeEach(() => {
    const sessionServiceSpy = jasmine.createSpyObj('SessionService', [
      'setActiveShip',
      'getSessionKey',
    ]);

    const shipServiceSpy = jasmine.createSpyObj('ShipService', ['listShipsByOwner']);

    TestBed.configureTestingModule({
      providers: [
        MissionNavigationService,
        { provide: SessionService, useValue: sessionServiceSpy },
        { provide: ShipService, useValue: shipServiceSpy },
      ],
    });

    service = TestBed.inject(MissionNavigationService);
    sessionService = TestBed.inject(SessionService) as jasmine.SpyObj<SessionService>;
    shipService = TestBed.inject(ShipService) as jasmine.SpyObj<ShipService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return prepared navigation state with mission context', async () => {
    const testCharacter = {
      id: 'char-123',
      characterName: 'Test Character',
    };

    const context: MissionNavigationContext = {
      missionId: 'test-mission',
      playerName: 'test-player',
      joinCharacter: testCharacter,
      sessionKey: 'session-key',
    };

    // Mock ship service to return empty list (ship fetch fails gracefully)
    shipService.listShipsByOwner.and.callFake((_request, callback) => {
      callback({
        success: false,
        message: 'No ships',
        correlationId: '00000000-0000-4000-8000-000000000009',
        requestIdentity: {
          operation: 'list-ships-by-owner',
          entityType: 'ship',
          containerId: 'char-123',
        },
        owner: {
          ownerType: 'player-character',
          playerId: 'player-1',
          characterId: 'char-123',
          npcId: null,
          factionId: null,
        },
        ships: [],
      });
    });

    const result = await service.prepareNavigation(context);

    expect(result.playerName).toBe('test-player');
    expect(result.joinCharacter).toBe(testCharacter);
    expect(result.missionContext).toBeDefined();
    expect(result.missionContext.missionId).toBe('test-mission');
  });

  it('should handle missing playerName gracefully', async () => {
    const testCharacter = {
      id: 'char-123',
      characterName: 'Test Character',
    };

    const context: MissionNavigationContext = {
      missionId: 'test-mission',
      playerName: '',
      joinCharacter: testCharacter,
      sessionKey: 'session-key',
    };

    shipService.listShipsByOwner.and.callFake((_request, callback) => {
      callback({
        success: false,
        message: '',
        correlationId: '00000000-0000-4000-8000-000000000010',
        requestIdentity: {
          operation: 'list-ships-by-owner',
          entityType: 'ship',
          containerId: 'unknown',
        },
        owner: {
          ownerType: 'player-character',
          playerId: null,
          characterId: null,
          npcId: null,
          factionId: null,
        },
        ships: [],
      });
    });

    const result = await service.prepareNavigation(context);

    expect(result.playerName).toBe('');
    expect(result.joinShip).toBeUndefined();
    expect(result.missionContext).toBeDefined();
  });

  it('should not call ship service when session key is missing', async () => {
    const testCharacter = {
      id: 'char-123',
      characterName: 'Test Character',
    };

    const context: MissionNavigationContext = {
      missionId: 'test-mission',
      playerName: 'test-player',
      joinCharacter: testCharacter,
      sessionKey: '',
    };

    const result = await service.prepareNavigation(context);

    expect(shipService.listShipsByOwner).not.toHaveBeenCalled();
    expect(result.joinShip).toBeUndefined();
  });
});
