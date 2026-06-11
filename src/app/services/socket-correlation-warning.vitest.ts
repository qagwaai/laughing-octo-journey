import { emitSocketCorrelationWarning } from './socket-correlation-warning';

describe('emitSocketCorrelationWarning', () => {
  it('dispatches socket-correlation-warning with detail payload', () => {
    const dispatchSpy = vi.fn().mockReturnValue(true);
    const target = { dispatchEvent: dispatchSpy };
    const detail = {
      operation: 'item-upsert',
      correlationId: 'corr-1',
      expectedRequestIdentity: { operation: 'item-upsert' },
      responseItemType: 'ore',
    };

    emitSocketCorrelationWarning(detail, target);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('socket-correlation-warning');
    expect(event.detail).toEqual(detail);
  });

  it('no-ops when event target is null', () => {
    expect(() => {
      emitSocketCorrelationWarning(
        {
          operation: 'ship-upsert',
          correlationId: 'corr-2',
          expectedRequestIdentity: { operation: 'ship-upsert' },
        },
        null,
      );
    }).not.toThrow();
  });
});
