import { describe, expect, it, vi } from 'vitest';
import { ShipExteriorInputAdapter } from './ship-exterior-input-adapter';

describe('ShipExteriorInputAdapter', () => {
  it('attaches all window/document listeners', () => {
    const fixture = createFixture();

    fixture.adapter.attach();

    expect(fixture.win.addEventListener).toHaveBeenCalledTimes(7);
    expect(fixture.doc.addEventListener).toHaveBeenCalledTimes(4);

    expect(fixture.win.addEventListener).toHaveBeenCalledWith('pointerdown', fixture.handlers.onWindowPointerDown);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('pointerup', fixture.handlers.onWindowPointerUp);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('contextmenu', fixture.handlers.onWindowContextMenu);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('keydown', fixture.handlers.onWindowKeyDown);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('keyup', fixture.handlers.onWindowKeyUp);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('mousemove', fixture.handlers.onWindowMouseMove);
    expect(fixture.doc.addEventListener).toHaveBeenCalledWith('keydown', fixture.handlers.onWindowKeyDown as EventListener);
    expect(fixture.doc.addEventListener).toHaveBeenCalledWith('keyup', fixture.handlers.onWindowKeyUp as EventListener);
    expect(fixture.doc.addEventListener).toHaveBeenCalledWith(
      'mousemove',
      fixture.handlers.onWindowMouseMove as EventListener,
    );
    expect(fixture.win.addEventListener).toHaveBeenCalledWith(
      'socket-correlation-warning',
      fixture.handlers.onSocketCorrelationWarning as EventListener,
    );
    expect(fixture.doc.addEventListener).toHaveBeenCalledWith(
      'pointerlockchange',
      fixture.handlers.onPointerLockChange as EventListener,
    );
  });

  it('detaches all listeners after attach', () => {
    const fixture = createFixture();

    fixture.adapter.attach();
    fixture.adapter.detach();

    expect(fixture.win.removeEventListener).toHaveBeenCalledTimes(7);
    expect(fixture.doc.removeEventListener).toHaveBeenCalledTimes(4);

    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('pointerdown', fixture.handlers.onWindowPointerDown);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('pointerup', fixture.handlers.onWindowPointerUp);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('contextmenu', fixture.handlers.onWindowContextMenu);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('keydown', fixture.handlers.onWindowKeyDown);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('keyup', fixture.handlers.onWindowKeyUp);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('mousemove', fixture.handlers.onWindowMouseMove);
    expect(fixture.doc.removeEventListener).toHaveBeenCalledWith(
      'keydown',
      fixture.handlers.onWindowKeyDown as EventListener,
    );
    expect(fixture.doc.removeEventListener).toHaveBeenCalledWith('keyup', fixture.handlers.onWindowKeyUp as EventListener);
    expect(fixture.doc.removeEventListener).toHaveBeenCalledWith(
      'mousemove',
      fixture.handlers.onWindowMouseMove as EventListener,
    );
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith(
      'socket-correlation-warning',
      fixture.handlers.onSocketCorrelationWarning as EventListener,
    );
    expect(fixture.doc.removeEventListener).toHaveBeenCalledWith(
      'pointerlockchange',
      fixture.handlers.onPointerLockChange as EventListener,
    );
  });

  it('does not double-attach listeners when attach is called repeatedly', () => {
    const fixture = createFixture();

    fixture.adapter.attach();
    fixture.adapter.attach();

    expect(fixture.win.addEventListener).toHaveBeenCalledTimes(7);
    expect(fixture.doc.addEventListener).toHaveBeenCalledTimes(4);
  });

  it('treats detach as no-op before attach and after first detach', () => {
    const fixture = createFixture();

    fixture.adapter.detach();
    fixture.adapter.attach();
    fixture.adapter.detach();
    fixture.adapter.detach();

    expect(fixture.win.removeEventListener).toHaveBeenCalledTimes(7);
    expect(fixture.doc.removeEventListener).toHaveBeenCalledTimes(4);
  });
});

function createFixture() {
  const handlers = {
    onWindowPointerDown: vi.fn(),
    onWindowPointerUp: vi.fn(),
    onWindowContextMenu: vi.fn(),
    onWindowKeyDown: vi.fn(),
    onWindowKeyUp: vi.fn(),
    onWindowMouseMove: vi.fn(),
    onSocketCorrelationWarning: vi.fn(),
    onPointerLockChange: vi.fn(),
  };

  const win = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const doc = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const adapter = new ShipExteriorInputAdapter(handlers, win, doc);

  return { handlers, win, doc, adapter };
}
