import { describe, expect, it } from 'vitest';
import { resolveOwnershipFailureMessage } from './ownership-error';

describe('resolveOwnershipFailureMessage', () => {
  it('returns mapped message for known reason code', () => {
    expect(resolveOwnershipFailureMessage('OWNERSHIP_ACCEPT_FORBIDDEN', 'fallback')).toBe(
      'Only the listing owner can accept this offer.',
    );
  });

  it('returns fallback for unknown reason code', () => {
    expect(resolveOwnershipFailureMessage('SOME_NEW_REASON', 'fallback message')).toBe('fallback message');
  });

  it('returns fallback when reason is empty', () => {
    expect(resolveOwnershipFailureMessage('   ', 'fallback message')).toBe('fallback message');
  });
});
