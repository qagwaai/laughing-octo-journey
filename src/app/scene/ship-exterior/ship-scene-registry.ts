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

    const previous = this.getActiveContext();
    if (previous && previous.contextKey !== contextKey) {
      previous.pause();
    }

    this.activeContextKey = contextKey;
    target.resume();
    return target;
  }

  pause(contextKey: string): void {
    this.contexts.get(contextKey)?.pause();
  }

  dispose(): void {
    this.contexts.forEach((context) => context.disposeRendering());
    this.contexts.clear();
    this.activeContextKey = null;
  }
}
