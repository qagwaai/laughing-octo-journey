import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// jsdom does not provide ResizeObserver; some components/libraries require it at runtime.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver = ResizeObserver;
}

// jsdom canvas support is partial; provide a minimal 2D context for libraries
// that touch canvas during module initialization.
if (typeof globalThis.HTMLCanvasElement !== 'undefined') {
  const canvasProto = globalThis.HTMLCanvasElement.prototype as HTMLCanvasElement['prototype'] & {
    getContext: (contextId: string) => unknown;
  };

  canvasProto.getContext = ((contextId: string) => {
    if (contextId !== '2d') {
      return null;
    }

    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      setTransform: () => {},
      drawImage: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {},
      measureText: () => ({ width: 0 }),
    };
  }) as HTMLCanvasElement['getContext'];
}

setupTestBed({
  zoneless: false,
});
