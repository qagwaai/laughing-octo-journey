import { signal, type WritableSignal } from '@angular/core';

/** Writable signal type used by testing mocks. */
export type WritableSignalLike<T> = WritableSignal<T>;

export function createSignal<T>(initial: T): WritableSignalLike<T> {
  return signal(initial);
}
