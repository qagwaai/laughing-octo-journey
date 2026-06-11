import { resolveShipExteriorViewSeedPolicy } from './ship-exterior-view-context';

describe('resolveShipExteriorViewSeedPolicy', () => {
  it('should honor explicit new seed policy', () => {
    expect(resolveShipExteriorViewSeedPolicy({ seedPolicy: 'new', missionStatusHint: 'active' })).toBe('new');
  });

  it('should honor explicit resume seed policy', () => {
    expect(resolveShipExteriorViewSeedPolicy({ seedPolicy: 'resume', missionStatusHint: 'completed' })).toBe('resume');
  });

  it('should default auto policy to resume when mission status hint is missing', () => {
    expect(resolveShipExteriorViewSeedPolicy({ seedPolicy: 'auto' })).toBe('resume');
    expect(resolveShipExteriorViewSeedPolicy({})).toBe('resume');
    expect(resolveShipExteriorViewSeedPolicy({ missionStatusHint: null })).toBe('resume');
  });

  it('should resolve status-based behavior for auto policy', () => {
    expect(resolveShipExteriorViewSeedPolicy({ seedPolicy: 'auto', missionStatusHint: 'active' })).toBe('resume');
    expect(resolveShipExteriorViewSeedPolicy({ seedPolicy: 'auto', missionStatusHint: 'completed' })).toBe('resume');
    expect(resolveShipExteriorViewSeedPolicy({ seedPolicy: 'auto', missionStatusHint: 'available' })).toBe('new');
  });
});
