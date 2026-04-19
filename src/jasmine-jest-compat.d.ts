/**
 * Augments Jasmine's matcher types with jest-compatible matchers used in
 * files that have not yet been fully migrated to Jasmine.
 * Once all files are migrated, this file can be deleted.
 */
declare namespace jasmine {
  interface Matchers<T> {
    toHaveLength(expected: number): void;
  }
  interface ArrayLikeMatchers<T> {
    toHaveLength(expected: number): void;
  }
}
