export interface ShipExteriorInputAdapterHandlers {
  onWindowPointerDown: (event: PointerEvent) => void;
  onWindowPointerUp: (event: PointerEvent) => void;
  onWindowContextMenu: (event: MouseEvent) => void;
  onWindowKeyDown: (event: KeyboardEvent) => void;
  onWindowKeyUp: (event: KeyboardEvent) => void;
  onWindowMouseMove: (event: MouseEvent) => void;
  onSocketCorrelationWarning: (event: Event) => void;
  onPointerLockChange: () => void;
}

/**
 * Encapsulates global input listener wiring for ship exterior scene lifecycle.
 */
export class ShipExteriorInputAdapter {
  private attached = false;

  constructor(
    private readonly handlers: ShipExteriorInputAdapterHandlers,
    private readonly win: Pick<Window, 'addEventListener' | 'removeEventListener'>,
    private readonly doc: Pick<Document, 'addEventListener' | 'removeEventListener'>,
  ) {}

  attach(): void {
    if (this.attached) {
      return;
    }

    this.win.addEventListener('pointerdown', this.handlers.onWindowPointerDown);
    this.win.addEventListener('pointerup', this.handlers.onWindowPointerUp);
    this.win.addEventListener('contextmenu', this.handlers.onWindowContextMenu);
    this.win.addEventListener('keydown', this.handlers.onWindowKeyDown);
    this.win.addEventListener('keyup', this.handlers.onWindowKeyUp);
    this.win.addEventListener('mousemove', this.handlers.onWindowMouseMove);
    this.doc.addEventListener('keydown', this.handlers.onWindowKeyDown as EventListener);
    this.doc.addEventListener('keyup', this.handlers.onWindowKeyUp as EventListener);
    this.doc.addEventListener('mousemove', this.handlers.onWindowMouseMove as EventListener);
    this.win.addEventListener('socket-correlation-warning', this.handlers.onSocketCorrelationWarning as EventListener);
    this.doc.addEventListener('pointerlockchange', this.handlers.onPointerLockChange as EventListener);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) {
      return;
    }

    this.win.removeEventListener('pointerdown', this.handlers.onWindowPointerDown);
    this.win.removeEventListener('pointerup', this.handlers.onWindowPointerUp);
    this.win.removeEventListener('contextmenu', this.handlers.onWindowContextMenu);
    this.win.removeEventListener('keydown', this.handlers.onWindowKeyDown);
    this.win.removeEventListener('keyup', this.handlers.onWindowKeyUp);
    this.win.removeEventListener('mousemove', this.handlers.onWindowMouseMove);
    this.doc.removeEventListener('keydown', this.handlers.onWindowKeyDown as EventListener);
    this.doc.removeEventListener('keyup', this.handlers.onWindowKeyUp as EventListener);
    this.doc.removeEventListener('mousemove', this.handlers.onWindowMouseMove as EventListener);
    this.win.removeEventListener('socket-correlation-warning', this.handlers.onSocketCorrelationWarning as EventListener);
    this.doc.removeEventListener('pointerlockchange', this.handlers.onPointerLockChange as EventListener);
    this.attached = false;
  }
}
