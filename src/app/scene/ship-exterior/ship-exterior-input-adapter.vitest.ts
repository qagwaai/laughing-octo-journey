import { describe, expect, it, vi } from 'vitest';
import { isShipExteriorInteractiveTarget, ShipExteriorInputAdapter } from './ship-exterior-input-adapter';

describe('isShipExteriorInteractiveTarget', () => {
  it.each(['input', 'textarea', 'select', 'button'])('protects %s controls', (tag) => {
    expect(isShipExteriorInteractiveTarget(document.createElement(tag))).toBe(true);
  });

  it.each(['', 'true', 'plaintext-only'])('protects descendants of contenteditable="%s"', (value) => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', value);
    const child = editor.appendChild(document.createElement('span'));
    expect(isShipExteriorInteractiveTarget(child)).toBe(true);
    expect(isShipExteriorInteractiveTarget(child.appendChild(document.createTextNode('A')))).toBe(true);
  });

  it('protects links, textbox roles and nested button content', () => {
    const link = document.createElement('a');
    link.href = '#';
    const textbox = document.createElement('div');
    textbox.setAttribute('role', 'textbox');
    const child = document.createElement('button').appendChild(document.createElement('span'));
    for (const target of [link, textbox, child]) {
      expect(isShipExteriorInteractiveTarget(target)).toBe(true);
    }
  });

  it('allows non-interactive viewport targets', () => {
    const element = document.createElement('div');
    element.setAttribute('contenteditable', 'false');
    for (const target of [null, window, document.createElement('canvas'), element]) {
      expect(isShipExteriorInteractiveTarget(target)).toBe(false);
    }
  });
});

describe('ShipExteriorInputAdapter', () => {
  it('attaches all window/document listeners', () => {
    const fixture = createFixture();

    fixture.adapter.attach();

    expect(fixture.win.addEventListener).toHaveBeenCalledTimes(8);
    expect(fixture.doc.addEventListener).toHaveBeenCalledTimes(4);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('blur', fixture.handlers.onWindowBlur);
    expect(fixture.doc.addEventListener).toHaveBeenCalledWith('visibilitychange', fixture.handlers.onVisibilityChange);

    expect(fixture.win.addEventListener).toHaveBeenCalledWith('pointerdown', fixture.handlers.onWindowPointerDown, true);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('pointerup', fixture.handlers.onWindowPointerUp);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('contextmenu', fixture.handlers.onWindowContextMenu);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('keydown', fixture.handlers.onWindowKeyDown);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('keyup', fixture.handlers.onWindowKeyUp);
    expect(fixture.win.addEventListener).toHaveBeenCalledWith('mousemove', fixture.handlers.onWindowMouseMove);
    expect(fixture.doc.addEventListener).toHaveBeenCalledWith(
      'keydown',
      fixture.handlers.onWindowKeyDown as EventListener,
    );
    expect(fixture.doc.addEventListener).toHaveBeenCalledWith('keyup', fixture.handlers.onWindowKeyUp as EventListener);
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

    expect(fixture.win.removeEventListener).toHaveBeenCalledTimes(8);
    expect(fixture.doc.removeEventListener).toHaveBeenCalledTimes(4);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('blur', fixture.handlers.onWindowBlur);
    expect(fixture.doc.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      fixture.handlers.onVisibilityChange,
    );

    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('pointerdown', fixture.handlers.onWindowPointerDown, true);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('pointerup', fixture.handlers.onWindowPointerUp);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('contextmenu', fixture.handlers.onWindowContextMenu);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('keydown', fixture.handlers.onWindowKeyDown);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('keyup', fixture.handlers.onWindowKeyUp);
    expect(fixture.win.removeEventListener).toHaveBeenCalledWith('mousemove', fixture.handlers.onWindowMouseMove);
    expect(fixture.doc.removeEventListener).toHaveBeenCalledWith(
      'keydown',
      fixture.handlers.onWindowKeyDown as EventListener,
    );
    expect(fixture.doc.removeEventListener).toHaveBeenCalledWith(
      'keyup',
      fixture.handlers.onWindowKeyUp as EventListener,
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

    expect(fixture.win.addEventListener).toHaveBeenCalledTimes(8);
    expect(fixture.doc.addEventListener).toHaveBeenCalledTimes(4);
  });

  it('treats detach as no-op before attach and after first detach', () => {
    const fixture = createFixture();

    fixture.adapter.detach();
    fixture.adapter.attach();
    fixture.adapter.detach();
    fixture.adapter.detach();

    expect(fixture.win.removeEventListener).toHaveBeenCalledTimes(8);
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
    onWindowBlur: vi.fn(),
    onVisibilityChange: vi.fn(),
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
