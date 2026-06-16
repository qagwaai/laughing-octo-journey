import {
  ShipExteriorViewStateService,
  type ShipExteriorViewStateContext,
} from './ship-exterior-view-state.service';

describe('ShipExteriorViewStateService', () => {
  let service: ShipExteriorViewStateService;
  let context: ShipExteriorViewStateContext;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    service = new ShipExteriorViewStateService();
    context = {
      playerName: 'Pioneer',
      characterId: 'char-1',
      shipId: 'ship-1',
    };
  });

  it('returns null when no orientation exists', () => {
    expect(service.loadOrientation(context)).toBeNull();
  });

  it('saves and restores orientation for a context', () => {
    service.saveOrientation(context, {
      yawRad: 1.2,
      pitchRad: -0.4,
      rollRad: 0.3,
    });

    expect(service.loadOrientation(context)).toEqual({
      yawRad: 1.2,
      pitchRad: -0.4,
      rollRad: 0.3,
    });
  });

  it('isolates orientation by player and character', () => {
    service.saveOrientation(context, {
      yawRad: 0.6,
      pitchRad: 0.2,
      rollRad: 0,
    });

    expect(
      service.loadOrientation({
        playerName: 'OtherPilot',
        characterId: 'char-1',
        shipId: 'ship-1',
      }),
    ).toBeNull();
    expect(
      service.loadOrientation({
        playerName: 'Pioneer',
        characterId: 'char-2',
        shipId: 'ship-1',
      }),
    ).toBeNull();
  });

  it('normalizes player-name casing and whitespace in keys', () => {
    service.saveOrientation(
      {
        playerName: '  Pioneer  ',
        characterId: 'char-1',
        shipId: 'ship-1',
      },
      {
        yawRad: 0.9,
        pitchRad: 0.1,
        rollRad: -0.2,
      },
    );

    expect(
      service.loadOrientation({
        playerName: 'pioneer',
        characterId: 'char-1',
        shipId: 'ship-1',
      }),
    ).toEqual({
      yawRad: 0.9,
      pitchRad: 0.1,
      rollRad: -0.2,
    });
  });

  it('returns null for malformed payloads', () => {
    sessionStorage.setItem('ship-exterior:view-state:pioneer:char-1:ship-1', '{bad-json');
    expect(service.loadOrientation(context)).toBeNull();
  });

  it('returns null when payload is missing finite numeric fields', () => {
    sessionStorage.setItem('ship-exterior:view-state:pioneer:char-1:ship-1', JSON.stringify({ yawRad: 1, pitchRad: 'x' }));
    expect(service.loadOrientation(context)).toBeNull();
  });

  it('clears saved orientation', () => {
    service.saveOrientation(context, {
      yawRad: 0.2,
      pitchRad: 0.4,
      rollRad: 0.6,
    });
    expect(service.loadOrientation(context)).not.toBeNull();

    service.clearOrientation(context);
    expect(service.loadOrientation(context)).toBeNull();
  });

  it('returns null when no camera pose exists', () => {
    expect(service.loadCameraPose(context)).toBeNull();
  });

  it('saves and restores camera pose for a context', () => {
    service.saveCameraPose(context, {
      position: { x: 12.5, y: -4.1, z: 33.2 },
      quaternion: { w: 0.9, x: 0.1, y: -0.2, z: 0.3 },
    });

    expect(service.loadCameraPose(context)).toEqual({
      position: { x: 12.5, y: -4.1, z: 33.2 },
      quaternion: { w: 0.9, x: 0.1, y: -0.2, z: 0.3 },
    });
  });

  it('isolates camera pose by player and character', () => {
    service.saveCameraPose(context, {
      position: { x: 1, y: 2, z: 3 },
      quaternion: { w: 1, x: 0, y: 0, z: 0 },
    });

    expect(
      service.loadCameraPose({
        playerName: 'OtherPilot',
        characterId: 'char-1',
        shipId: 'ship-1',
      }),
    ).toBeNull();
    expect(
      service.loadCameraPose({
        playerName: 'Pioneer',
        characterId: 'char-2',
        shipId: 'ship-1',
      }),
    ).toBeNull();
  });

  it('returns null for malformed camera pose payloads', () => {
    sessionStorage.setItem('ship-exterior:camera-pose:pioneer:char-1:ship-1', '{bad-json');
    expect(service.loadCameraPose(context)).toBeNull();
  });

  it('returns null when camera pose payload has non-finite values', () => {
    sessionStorage.setItem(
      'ship-exterior:camera-pose:pioneer:char-1:ship-1',
      JSON.stringify({
        position: { x: 1, y: 'bad', z: 3 },
        quaternion: { w: 1, x: 0, y: 0, z: 0 },
      }),
    );
    expect(service.loadCameraPose(context)).toBeNull();
  });

  it('clears saved camera pose', () => {
    service.saveCameraPose(context, {
      position: { x: 4, y: 5, z: 6 },
      quaternion: { w: 0.8, x: 0.1, y: 0.2, z: 0.3 },
    });
    expect(service.loadCameraPose(context)).not.toBeNull();

    service.clearCameraPose(context);
    expect(service.loadCameraPose(context)).toBeNull();
  });

  it('returns null when no flight preferences exist', () => {
    expect(service.loadFlightPreferences(context)).toBeNull();
  });

  it('saves and restores flight preferences for a context', () => {
    service.saveFlightPreferences(context, {
      invertY: true,
      mouseSensitivity: 0.0042,
    });

    expect(service.loadFlightPreferences(context)).toEqual({
      invertY: true,
      mouseSensitivity: 0.0042,
    });
  });

  it('isolates flight preferences by player and character', () => {
    service.saveFlightPreferences(context, {
      invertY: false,
      mouseSensitivity: 0.0025,
    });

    expect(
      service.loadFlightPreferences({
        playerName: 'OtherPilot',
        characterId: 'char-1',
        shipId: 'ship-1',
      }),
    ).toBeNull();
    expect(
      service.loadFlightPreferences({
        playerName: 'Pioneer',
        characterId: 'char-2',
        shipId: 'ship-1',
      }),
    ).toBeNull();
  });

  it('returns null for malformed flight preference payloads', () => {
    localStorage.setItem('ship-exterior:flight-preferences:pioneer:char-1:ship-1', '{bad-json');
    expect(service.loadFlightPreferences(context)).toBeNull();
  });

  it('returns null when flight preferences are missing required fields', () => {
    localStorage.setItem(
      'ship-exterior:flight-preferences:pioneer:char-1:ship-1',
      JSON.stringify({ invertY: 'yes', mouseSensitivity: 0.003 }),
    );
    expect(service.loadFlightPreferences(context)).toBeNull();
  });

  it('clears saved flight preferences', () => {
    service.saveFlightPreferences(context, {
      invertY: true,
      mouseSensitivity: 0.005,
    });
    expect(service.loadFlightPreferences(context)).not.toBeNull();

    service.clearFlightPreferences(context);
    expect(service.loadFlightPreferences(context)).toBeNull();
  });
});