/** Lightweight writable-signal substitute for use in spec files. */
export type WritableSignalLike<T> = (() => T) & { set(v: T): void };

export function createSignal<T>(initial: T): WritableSignalLike<T> {
  let value = initial;
  const sig = (() => value) as WritableSignalLike<T>;
  sig.set = (v: T) => {
    value = v;
  };
  return sig;
}
