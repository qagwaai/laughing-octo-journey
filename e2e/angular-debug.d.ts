export {};

declare global {
  interface Window {
    ng?: {
      getComponent(element: Element): unknown;
    };
  }
}
