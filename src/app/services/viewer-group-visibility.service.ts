import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ViewerGroupVisibilityService {
  private readonly excludedGroups = signal<ReadonlySet<string>>(new Set(['asteroids', 'comet']));

  isGroupIncluded(group: string): boolean {
    return !this.excludedGroups().has(group);
  }

  setGroupIncluded(group: string, included: boolean): void {
    this.excludedGroups.update((current) => {
      const next = new Set(current);
      if (included) next.delete(group);
      else next.add(group);
      return next;
    });
  }
}
