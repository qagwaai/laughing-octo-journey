import { describe, expect, it } from 'vitest';
import { ViewerTargetService } from './viewer-target.service';

describe('ViewerTargetService', () => {
  it('starts with no target selected', () => {
    const service = new ViewerTargetService();

    expect(service.targetBodyId()).toBeNull();
  });

  it('stores and clears target ids', () => {
    const service = new ViewerTargetService();

    service.target('body-42');
    expect(service.targetBodyId()).toBe('body-42');

    service.clearTarget();
    expect(service.targetBodyId()).toBeNull();
  });
});
