/**
 * Karma plugin for Jest compatibility matchers
 */
module.exports = {
  'framework:jasmine-jest-compat': [
    'factory',
    function () {
      return {
        name: 'jasmine-jest-compat',
      };
    },
  ],
};

// Add matcher registration
const jasmineCore = require('jasmine-core');

function patchJasmine() {
  const originalIt = global.it;
  const originalBeforeEach = global.beforeEach;

  let haveAddedMatchers = false;

  global.it = function (...args) {
    if (!haveAddedMatchers && global.jasmine) {
      jasmine.addMatchers({
        toHaveLength: () => ({
          compare(actual, expected) {
            const pass = actual?.length === expected;
            const message = pass
              ? `expected ${actual} not to have length ${expected}`
              : `expected ${actual} to have length ${expected}, but it has ${actual?.length}`;
            return { pass, message };
          },
        }),
      });
      haveAddedMatchers = true;
    }
    return originalIt.apply(this, args);
  };

  global.beforeEach = function (...args) {
    if (!haveAddedMatchers && global.jasmine) {
      jasmine.addMatchers({
        toHaveLength: () => ({
          compare(actual, expected) {
            const pass = actual?.length === expected;
            const message = pass
              ? `expected ${actual} not to have length ${expected}`
              : `expected ${actual} to have length ${expected}, but it has ${actual?.length}`;
            return { pass, message };
          },
        }),
      });
      haveAddedMatchers = true;
    }
    return originalBeforeEach.apply(this, args);
  };
}

patchJasmine();
