import { TestBed } from '@angular/core/testing';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import { InventoryRewardService } from './inventory-reward.service';

describe('InventoryRewardService', () => {
  let service: InventoryRewardService;
  let socketService: { upsertItem: ReturnType<typeof vi.fn> };
  let sessionService: {
    activeShip: ReturnType<typeof vi.fn>;
    setActiveShip: ReturnType<typeof vi.fn>;
    getSessionKey: ReturnType<typeof vi.fn>;
    getPlayerName: ReturnType<typeof vi.fn>;
    activeCharacter: ReturnType<typeof vi.fn>;
  };
  let activeShip: any;

  beforeEach(() => {
    activeShip = {
      id: 'ship-42',
      inventory: [{ id: 'item-1', itemType: 'scrap' }],
      ownership: { playerId: 'player-7' },
    };

    socketService = {
      upsertItem: vi.fn(),
    };

    sessionService = {
      activeShip: vi.fn(() => activeShip),
      setActiveShip: vi.fn((nextShip) => {
        activeShip = nextShip;
      }),
      getSessionKey: vi.fn(() => 'session-123'),
      getPlayerName: vi.fn(() => 'PilotOne'),
      activeCharacter: vi.fn(() => ({ id: 'char-42' })),
    };

    TestBed.configureTestingModule({
      providers: [
        InventoryRewardService,
        { provide: SocketService, useValue: socketService },
        { provide: SessionService, useValue: sessionService },
      ],
    });

    service = TestBed.inject(InventoryRewardService);
  });

  it('expands material rewards into ship items and persists them', () => {
    const nextShip = service.applyMaterialRewards(
      [{ material: 'Iron', quantity: 2 }],
      activeShip,
      'char-42',
    );

    expect(nextShip?.inventory).toHaveLength(3);
    expect(nextShip?.inventory.map((item: any) => item.itemType)).toEqual(['scrap', 'iron', 'iron']);
    expect(socketService.upsertItem).toHaveBeenCalledTimes(2);
    expect(socketService.upsertItem.mock.calls[0][0].item.itemType).toBe('iron');
  });

  it('expands yielded item quantities and records them on the active ship', () => {
    const nextShip = service.applyYieldedItems(
      [
        {
          id: 'yield-1',
          itemType: 'repair-kit',
          displayName: 'Repair Kit',
          launchable: true,
          state: 'contained',
          quantity: 3,
          container: { containerType: 'ship', containerId: 'ship-42' },
        },
      ],
      activeShip,
      'char-42',
    );

    expect(nextShip?.inventory).toHaveLength(4);
    expect(nextShip?.inventory.filter((item: any) => item.itemType === 'repair-kit')).toHaveLength(3);
    expect(socketService.upsertItem).toHaveBeenCalledTimes(3);
  });

  it('skips backend persistence when the identity context is incomplete', () => {
    sessionService.getSessionKey.mockReturnValue('');
    sessionService.getPlayerName.mockReturnValue('');
    sessionService.activeCharacter.mockReturnValue({ id: '' });

    service.persistRewardItemsToBackend(
      [{
        id: 'item-3',
        itemType: 'iron',
        displayName: 'Iron',
        launchable: false,
        state: 'contained',
        damageStatus: 'intact',
        container: null,
        owningPlayerId: 'player-7',
        owningCharacterId: 'char-42',
        spatial: null,
        destroyedAt: null,
        destroyedReason: null,
        discoveredAt: null,
        discoveredByCharacterId: null,
        createdAt: '2026-08-27T00:00:00.000Z',
        updatedAt: '2026-08-27T00:00:00.000Z',
      }],
      { playerName: '', characterId: '', shipId: 'ship-42' },
    );

    expect(socketService.upsertItem).not.toHaveBeenCalled();
  });

  it('removes the launched item from the active ship inventory', () => {
    const nextShip = service.consumeLaunchedItem({ shipId: 'ship-42', itemId: 'item-1' } as any);

    expect(nextShip?.inventory).toHaveLength(0);
    expect(sessionService.setActiveShip).toHaveBeenCalledWith(nextShip);
  });
});
