import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';

@Injectable()
class VitestSmokeService {
  readonly value = 'ok';
}

describe('vitest Angular smoke', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VitestSmokeService],
    });
  });

  it('resolves a service from TestBed', () => {
    const service = TestBed.inject(VitestSmokeService);

    expect(service.value).toBe('ok');
  });
});
