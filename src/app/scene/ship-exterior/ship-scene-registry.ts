import { ShipSceneContext } from './ship-scene-context';
import { ShipSceneContextState } from './ship-scene-types';

export class ShipSceneRegistry {
  private readonly contexts = new Map<string, ShipSceneContext>();
  private activeContextKey: string | null = null;

  getOrCreateContext(contextKey: string, initialState: ShipSceneContextState): ShipSceneContext {
    const existing = this.contexts.get(contextKey);
    if (existing) {
      return existing;
    }

    const created = new ShipSceneContext(contextKey, initialState);
    this.contexts.set(contextKey, created);
    return created;
  }

  getContext(contextKey: string): ShipSceneContext | null {
    return this.contexts.get(contextKey) ?? null;
  }

  getAllContexts(): ShipSceneContext[] {
    return [...this.contexts.values()];
  }

  getActiveContextKey(): string | null {
    return this.activeContextKey;
  }

  getActiveContext(): ShipSceneContext | null {
    if (!this.activeContextKey) {
      return null;
    }

    return this.contexts.get(this.activeContextKey) ?? null;
  }

  activate(contextKey: string): ShipSceneContext | null {
    const target = this.contexts.get(contextKey);
    if (!target) {
      return null;
    }

    this.activeContextKey = contextKey;
    this.enforceActivePauseInvariants();
    return target;
  }

  pause(contextKey: string): void {
    this.contexts.get(contextKey)?.pause();

    if (this.activeContextKey === contextKey) {
      this.activeContextKey = null;
    }
  }

  deactivateAll(): void {
    this.activeContextKey = null;
    this.contexts.forEach((context) => context.pause());
  }

  removeContext(contextKey: string): boolean {
    const context = this.contexts.get(contextKey);
    if (!context) {
      return false;
    }

    context.disposeRendering();
    const wasActive = this.activeContextKey === contextKey;
    this.contexts.delete(contextKey);

    if (wasActive) {
      this.activeContextKey = null;
      const nextContext = this.getAllContexts()[0];
      if (nextContext) {
        this.activate(nextContext.contextKey);
      }
    }

    return true;
  }

  enforceActivePauseInvariants(): void {
    this.contexts.forEach((context, key) => {
      if (this.activeContextKey && key === this.activeContextKey) {
        context.resume();
        return;
      }

      context.pause();
    });
  }

  dispose(): void {
    this.deactivateAll();
    this.contexts.forEach((context) => context.disposeRendering());
    this.contexts.clear();
    this.activeContextKey = null;
  }
}
