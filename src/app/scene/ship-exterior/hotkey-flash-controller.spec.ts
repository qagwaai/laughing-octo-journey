import { HotkeyFlashController } from './hotkey-flash-controller';

describe('HotkeyFlashController', () => {
  beforeEach(() => jasmine.clock().install());
  afterEach(() => jasmine.clock().uninstall());

  it('starts with empty active set', () => {
    const controller = new HotkeyFlashController();
    expect(controller.active().size).toBe(0);
  });

  it('trigger() adds a hotkey then clears after the flash window', () => {
    const controller = new HotkeyFlashController(100);
    controller.trigger(2);
    expect(controller.active().has(2)).toBeTrue();
    jasmine.clock().tick(150);
    expect(controller.active().has(2)).toBeFalse();
  });

  it('triggers are independent per hotkey', () => {
    const controller = new HotkeyFlashController(100);
    controller.trigger(1);
    jasmine.clock().tick(50);
    controller.trigger(3);
    expect(controller.active().has(1)).toBeTrue();
    expect(controller.active().has(3)).toBeTrue();
    jasmine.clock().tick(60);
    expect(controller.active().has(1)).toBeFalse();
    expect(controller.active().has(3)).toBeTrue();
    jasmine.clock().tick(60);
    expect(controller.active().has(3)).toBeFalse();
  });

  it('re-triggering same hotkey extends its window', () => {
    const controller = new HotkeyFlashController(100);
    controller.trigger(4);
    jasmine.clock().tick(80);
    controller.trigger(4);
    jasmine.clock().tick(80);
    expect(controller.active().has(4)).toBeTrue();
    jasmine.clock().tick(50);
    expect(controller.active().has(4)).toBeFalse();
  });

  it('dispose() cancels every pending timer', () => {
    const controller = new HotkeyFlashController(100);
    controller.trigger(1);
    controller.trigger(2);
    controller.dispose();
    expect(controller.active().has(1)).toBeTrue();
    jasmine.clock().tick(500);
    // dispose only cancels timers; the active set is preserved as last-seen.
    expect(controller.active().has(1)).toBeTrue();
    expect(controller.active().has(2)).toBeTrue();
  });
});
