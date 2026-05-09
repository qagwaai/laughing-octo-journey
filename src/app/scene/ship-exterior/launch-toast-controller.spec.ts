import { LaunchToastController } from './launch-toast-controller';

describe('LaunchToastController', () => {
  beforeEach(() => jasmine.clock().install());
  afterEach(() => jasmine.clock().uninstall());

  it('starts with null toast', () => {
    const controller = new LaunchToastController();
    expect(controller.current()).toBeNull();
  });

  it('set() shows the toast and auto-dismisses after the timeout', () => {
    const controller = new LaunchToastController(1000);
    controller.set('Hello', 'success', 42);
    expect(controller.current()).toEqual({ message: 'Hello', tone: 'success', seed: 42 });
    jasmine.clock().tick(999);
    expect(controller.current()).not.toBeNull();
    jasmine.clock().tick(2);
    expect(controller.current()).toBeNull();
  });

  it('repeated set() resets the auto-dismiss timer', () => {
    const controller = new LaunchToastController(1000);
    controller.set('first', 'success', null);
    jasmine.clock().tick(900);
    controller.set('second', 'error', null);
    jasmine.clock().tick(900);
    expect(controller.current()?.message).toBe('second');
    jasmine.clock().tick(200);
    expect(controller.current()).toBeNull();
  });

  it('clear() clears immediately', () => {
    const controller = new LaunchToastController(1000);
    controller.set('x', 'success', null);
    controller.clear();
    expect(controller.current()).toBeNull();
  });

  it('dispose() cancels the auto-dismiss timer', () => {
    const controller = new LaunchToastController(1000);
    controller.set('x', 'success', null);
    controller.dispose();
    jasmine.clock().tick(2000);
    // dispose() does not clear the toast itself, only the timer
    expect(controller.current()?.message).toBe('x');
  });
});
