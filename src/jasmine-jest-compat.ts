/**
 * Runtime Jasmine matcher compatibility for jest-style assertions.
 * This file is loaded automatically by karma.conf.js in the files array.
 */

beforeEach(() => {
  jasmine.addMatchers({
    toHaveLength: () => ({
      compare(actual: any, expected: number) {
        const pass = actual?.length === expected;
        const message = pass
          ? `expected ${actual} not to have length ${expected}`
          : `expected ${actual} to have length ${expected}, but it has ${actual?.length}`;
        return { pass, message };
      },
    }),
  });
});
