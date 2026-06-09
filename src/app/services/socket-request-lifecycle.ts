import { Socket } from 'socket.io-client';
import { appLogger } from './logger';

export interface QueuedSocketRequestParams<TRequest, TResponse> {
  socket: Socket;
  domainKey: string;
  correlationId: string;
  requestEvent: string;
  responseEvent: string;
  requestPayload: TRequest;
  timeoutMs: number;
  isResponseForRequest: (response: TResponse) => boolean;
  onResponseMatched?: (response: TResponse) => void;
  onResponseMismatched?: (response: TResponse) => void;
  shouldIgnoreMismatch?: (response: TResponse) => boolean;
  onTimeout: () => void;
}

/**
 * Encapsulates queued socket request lifecycle concerns so callers can focus
 * on operation-specific request payload and response matching logic.
 */
export class SocketRequestLifecycle {
  private readonly domainPipelineByKey = new Map<string, Promise<void>>();
  private readonly pendingOperationCancelByCorrelationId = new Map<string, () => void>();

  clearDomainPipeline(): void {
    this.domainPipelineByKey.clear();
  }

  cancelPendingOperations(reason: string): void {
    const pendingOperations = Array.from(this.pendingOperationCancelByCorrelationId.entries());
    if (pendingOperations.length === 0) {
      return;
    }

    this.pendingOperationCancelByCorrelationId.clear();
    for (const [, cancelOperation] of pendingOperations) {
      try {
        cancelOperation();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        appLogger.error(`[socket-pending] Failed to cancel pending operation. reason=${reason} error=${errorMessage}`);
      }
    }

    appLogger.warn(`[socket-pending] Cleared pending operations. reason=${reason} count=${pendingOperations.length}`);
  }

  runQueuedRequestWithResponse<TRequest, TResponse>(params: QueuedSocketRequestParams<TRequest, TResponse>): void {
    this.enqueueDomainOperation(params.domainKey, () => {
      return new Promise<void>((resolve) => {
        let handled = false;
        let noResponseTimer: ReturnType<typeof setTimeout> | null = null;
        let unsubscribe: (() => void) | null = null;

        const complete = () => {
          if (handled) {
            return;
          }

          handled = true;
          this.clearPendingOperation(params.correlationId);
          if (noResponseTimer) {
            clearTimeout(noResponseTimer);
            noResponseTimer = null;
          }

          unsubscribe?.();
          unsubscribe = null;
          resolve();
        };

        const handleResponse = (response: TResponse) => {
          if (handled) {
            return;
          }

          if (params.isResponseForRequest(response)) {
            params.onResponseMatched?.(response);
            complete();
            return;
          }

          if (params.shouldIgnoreMismatch?.(response)) {
            return;
          }

          params.onResponseMismatched?.(response);
        };

        params.socket.on(params.responseEvent, handleResponse);
        unsubscribe = () => params.socket.off(params.responseEvent, handleResponse);

        noResponseTimer = setTimeout(() => {
          if (handled) {
            return;
          }

          params.onTimeout();
          complete();
        }, params.timeoutMs);

        this.registerPendingOperation(params.correlationId, complete);
        params.socket.emit(params.requestEvent, params.requestPayload);
      });
    });
  }

  private registerPendingOperation(correlationId: string, cancelOperation: () => void): void {
    this.pendingOperationCancelByCorrelationId.set(correlationId, cancelOperation);
  }

  private clearPendingOperation(correlationId: string): void {
    this.pendingOperationCancelByCorrelationId.delete(correlationId);
  }

  private enqueueDomainOperation(domainKey: string, operation: () => Promise<void>): void {
    const previous = this.domainPipelineByKey.get(domainKey);
    let next: Promise<void>;
    if (!previous) {
      next = operation()
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          appLogger.error(`[socket-pipeline] Domain operation failed. domainKey=${domainKey} error=${errorMessage}`);
        })
        .finally(() => {
          if (this.domainPipelineByKey.get(domainKey) === next) {
            this.domainPipelineByKey.delete(domainKey);
          }
        });

      this.domainPipelineByKey.set(domainKey, next);
      return;
    }

    next = previous
      .catch(() => undefined)
      .then(() => operation())
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        appLogger.error(`[socket-pipeline] Domain operation failed. domainKey=${domainKey} error=${errorMessage}`);
      })
      .finally(() => {
        if (this.domainPipelineByKey.get(domainKey) === next) {
          this.domainPipelineByKey.delete(domainKey);
        }
      });

    this.domainPipelineByKey.set(domainKey, next);
  }
}
