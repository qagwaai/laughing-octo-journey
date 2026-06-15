import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    service = new SessionService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with no session', () => {
    expect(service.hasSession()).toBe(false);
    expect(service.getSessionKey()).toBeNull();
  });

  it('should store a session key', () => {
    service.setSessionKey('abc-123');
    expect(service.hasSession()).toBe(true);
    expect(service.getSessionKey()).toBe('abc-123');
  });

  it('should clear a session', () => {
    service.setSessionKey('abc-123');
    service.clearSession();
    expect(service.hasSession()).toBe(false);
    expect(service.getSessionKey()).toBeNull();
  });

  it('should overwrite an existing session key', () => {
    service.setSessionKey('key-1');
    service.setSessionKey('key-2');
    expect(service.getSessionKey()).toBe('key-2');
  });

  describe('active ship', () => {
    const ship = {
      id: 'd-1',
      name: 'Surveyor',
      model: 'Scavenger Pod',
      tier: 1,
      status: 'ACTIVE',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric' as const,
        positionKm: { x: 1000, y: 0, z: 0 },
        epochMs: 100,
      },
    };

    it('should initialize with no active ship', () => {
      expect(service.activeShip()).toBeNull();
    });

    it('should store an active ship', () => {
      service.setActiveShip(ship as never);
      expect(service.activeShip()?.id).toBe('d-1');
      expect(service.activeShip()?.name).toBe('Surveyor');
    });

    it('should overwrite active ship when set again', () => {
      const other = {
        ...ship,
        id: 'd-2',
        name: 'Guardian',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric' as const,
          positionKm: { x: 2000, y: 0, z: 0 },
          epochMs: 200,
        },
      };
      service.setActiveShip(ship as never);
      service.setActiveShip(other as never);
      expect(service.activeShip()?.id).toBe('d-2');
      expect(service.activeShip()?.name).toBe('Guardian');
    });

    it('should preserve existing spatial when same-ship update has older epoch', () => {
      service.setActiveShip(ship as never);
      service.setActiveShip({
        ...ship,
        status: 'DAMAGED',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 100, y: 0, z: 0 },
          epochMs: 90,
        },
      } as never);

      expect(service.activeShip()?.status).toBe('DAMAGED');
      expect(service.activeShip()?.spatial.positionKm).toEqual({ x: 1000, y: 0, z: 0 });
      expect(service.activeShip()?.spatial.epochMs).toBe(100);
    });

    it('should preserve existing usable spatial when same-ship update has origin placeholder', () => {
      service.setActiveShip(ship as never);
      service.setActiveShip({
        ...ship,
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 0, y: 0, z: 0 },
          epochMs: 999,
        },
      } as never);

      expect(service.activeShip()?.spatial.positionKm).toEqual({ x: 1000, y: 0, z: 0 });
      expect(service.activeShip()?.spatial.epochMs).toBe(100);
    });

    it('should keep current usable spatial for the same ship even when incoming is newer', () => {
      service.setActiveShip(ship as never);
      service.setActiveShip({
        ...ship,
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 6000, y: 5, z: -8 },
          epochMs: 500,
        },
      } as never);

      expect(service.activeShip()?.spatial.positionKm).toEqual({ x: 1000, y: 0, z: 0 });
      expect(service.activeShip()?.spatial.epochMs).toBe(100);
    });

    it('should adopt incoming usable spatial when current same-ship spatial is unusable', () => {
      service.setActiveShip({
        ...ship,
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 0, y: 0, z: 0 },
          epochMs: 50,
        },
      } as never);
      service.setActiveShip({
        ...ship,
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 6000, y: 5, z: -8 },
          epochMs: 500,
        },
      } as never);

      expect(service.activeShip()?.spatial.positionKm).toEqual({ x: 6000, y: 5, z: -8 });
      expect(service.activeShip()?.spatial.epochMs).toBe(500);
    });

    it('should preserve spatial when same ship id differs only by case/whitespace', () => {
      service.setActiveShip({
        ...ship,
        id: 'SHIP-1',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 9000, y: 0, z: -4000 },
          epochMs: 700,
        },
      } as never);
      service.setActiveShip({
        ...ship,
        id: ' ship-1 ',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 100, y: 0, z: 0 },
          epochMs: 900,
        },
      } as never);

      expect(service.activeShip()?.spatial.positionKm).toEqual({ x: 9000, y: 0, z: -4000 });
    });

    it('should apply forceUpdateActiveShipSpatial to same ship bypassing stickiness', () => {
      service.setActiveShip(ship as never);
      service.forceUpdateActiveShipSpatial('d-1', {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 340090400, y: -135100, z: -214153344 },
        epochMs: 999,
      });

      expect(service.activeShip()?.spatial.positionKm).toEqual({ x: 340090400, y: -135100, z: -214153344 });
      expect(service.activeShip()?.spatial.epochMs).toBe(999);
    });

    it('should ignore forceUpdateActiveShipSpatial for different ship id', () => {
      service.setActiveShip(ship as never);
      service.forceUpdateActiveShipSpatial('other-ship', {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 0, y: 0, z: -9999 },
        epochMs: 999,
      });

      expect(service.activeShip()?.spatial.positionKm).toEqual({ x: 1000, y: 0, z: 0 });
    });

    it('should clear active ship independently', () => {
      service.setActiveShip(ship as never);
      service.clearActiveShip();
      expect(service.activeShip()).toBeNull();
    });

    it('should clear active ship when clearSession is called', () => {
      service.setSessionKey('key-1');
      service.setActiveShip(ship as never);
      service.clearSession();
      expect(service.activeShip()).toBeNull();
      expect(service.hasSession()).toBe(false);
    });
  });
});
