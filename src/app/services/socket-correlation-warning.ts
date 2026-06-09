export interface SocketCorrelationWarningDetail {
  operation: string;
  correlationId: string;
  expectedRequestIdentity: unknown;
  [key: string]: unknown;
}

export interface BrowserEventTarget {
  dispatchEvent: (event: Event) => boolean;
}

export function emitSocketCorrelationWarning(
  detail: SocketCorrelationWarningDetail,
  eventTarget: BrowserEventTarget | null =
    typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' ? window : null,
): void {
  if (!eventTarget) {
    return;
  }

  eventTarget.dispatchEvent(new CustomEvent('socket-correlation-warning', { detail }));
}
