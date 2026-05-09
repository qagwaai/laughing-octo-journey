export const appLogger = {
  debug: (...args: unknown[]): void => {
    console.debug(...args);
  },
  info: (...args: unknown[]): void => {
    console.info(...args);
  },
  log: (...args: unknown[]): void => {
    console.log(...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
