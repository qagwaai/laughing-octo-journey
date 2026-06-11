import {
  createCorrelationId,
  matchesBasicRequestIdentity,
  normalizeIdentityValue,
  type BasicRequestIdentity,
} from './socket-correlation';

describe('socket-correlation helpers', () => {
  it('creates operation-prefixed correlation ids', () => {
    const correlationId = createCorrelationId('mission-list');

    expect(correlationId.startsWith('mission-list:')).toBe(true);
    expect(correlationId.split(':').length).toBe(3);
  });

  it('creates unique correlation ids across back-to-back calls', () => {
    const first = createCorrelationId('mission-list');
    const second = createCorrelationId('mission-list');

    expect(first).not.toBe(second);
  });

  it('normalizes identity values as trimmed lowercase strings', () => {
    expect(normalizeIdentityValue('  SoL  ')).toBe('sol');
    expect(normalizeIdentityValue(undefined)).toBe('');
    expect(normalizeIdentityValue(42)).toBe('');
  });

  it('matches request identities after normalization', () => {
    const left: BasicRequestIdentity = {
      operation: '  Mission-List ',
      entityType: 'Mission',
      containerId: ' Char-1 ',
    };
    const right: BasicRequestIdentity = {
      operation: 'mission-list',
      entityType: 'mission',
      containerId: 'char-1',
    };

    expect(matchesBasicRequestIdentity(left, right)).toBe(true);
  });

  it('does not match request identities when one side is missing', () => {
    expect(matchesBasicRequestIdentity(undefined, { operation: 'mission-list' })).toBe(false);
    expect(matchesBasicRequestIdentity({ operation: 'mission-list' }, undefined)).toBe(false);
  });

  it('does not match request identities when any canonical field differs', () => {
    const left: BasicRequestIdentity = {
      operation: 'mission-list',
      entityType: 'mission',
      containerId: 'char-1',
    };

    expect(
      matchesBasicRequestIdentity(left, {
        operation: 'mission-list',
        entityType: 'mission',
        containerId: 'char-2',
      }),
    ).toBe(false);
    expect(
      matchesBasicRequestIdentity(left, {
        operation: 'mission-upsert',
        entityType: 'mission',
        containerId: 'char-1',
      }),
    ).toBe(false);
  });
});
