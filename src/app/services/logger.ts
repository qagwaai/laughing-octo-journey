/**
 * Centralized logging surface for non-test runtime code.
 */
const emitLoggerEntry = (level: 'warn' | 'error', args: unknown[]): void => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('app-logger-entry', {
      detail: {
        level,
        args,
      },
    }),
  );
};

export const appLogger = {
  debug: (...args: unknown[]): void => {
    console.debug(...args);
  },
  info: (...args: unknown[]): void => {
    console.info(...args);
  },
  log: (...args: unknown[]): void => {
    console.debug(...args);
  },
  warn: (...args: unknown[]): void => {
    emitLoggerEntry('warn', args);
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    emitLoggerEntry('error', args);
    console.error(...args);
  },
};
