import { Injectable, signal } from '@angular/core';

type ContractVarianceLevel = 'warn' | 'error';

interface ContractVarianceToast {
  id: number;
  level: ContractVarianceLevel;
  message: string;
  detail: unknown;
}

interface AppLoggerEntryEventDetail {
  level: 'warn' | 'error';
  args: unknown[];
}

@Injectable({ providedIn: 'root' })
export class ContractVarianceNotifierService {
  private static readonly TOAST_DURATION_MS = 6500;

  private readonly queue: ContractVarianceToast[] = [];
  private readonly nextId = signal(1);
  private hideTimer: number | null = null;
  private readonly activeToastState = signal<ContractVarianceToast | null>(null);

  readonly activeToast = this.activeToastState.asReadonly();

  private readonly onSocketCorrelationWarning = (event: Event): void => {
    const detail = (event as CustomEvent).detail ?? null;
    const detailRecord = this.asRecord(detail);
    const operation = this.asString(detailRecord['operation']) ?? 'unknown-operation';
    const reason = this.asString(detailRecord['reason']) ?? 'contract-warning';
    const message = `[socket-correlation] ${operation}: ${reason}`;

    this.enqueue('warn', message, detail);
    console.log('[contract-variance-notifier] socket-correlation-warning', detail);
  };

  private readonly onAppLoggerEntry = (event: Event): void => {
    const detail = (event as CustomEvent<AppLoggerEntryEventDetail>).detail;
    const level = detail?.level;
    const args = Array.isArray(detail?.args) ? detail.args : [];

    if ((level !== 'warn' && level !== 'error') || !this.isContractVarianceArgs(args)) {
      return;
    }

    const message = this.stringifyMessage(args);
    this.enqueue(level, message, { level, args });
    console.log('[contract-variance-notifier] app-logger-contract-variance', { level, args });
  };

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('socket-correlation-warning', this.onSocketCorrelationWarning as EventListener);
    window.addEventListener('app-logger-entry', this.onAppLoggerEntry as EventListener);
  }

  dismissActiveToast(): void {
    this.clearActiveToast();
    this.showNextToast();
  }

  private enqueue(level: ContractVarianceLevel, message: string, detail: unknown): void {
    const toast: ContractVarianceToast = {
      id: this.nextId(),
      level,
      message,
      detail,
    };
    this.nextId.update((value) => value + 1);
    this.queue.push(toast);
    this.showNextToast();
  }

  private showNextToast(): void {
    if (this.activeToastState() || this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift() ?? null;
    if (!next) {
      return;
    }

    this.activeToastState.set(next);
    this.scheduleAutoHide();
  }

  private scheduleAutoHide(): void {
    this.clearHideTimer();
    this.hideTimer = window.setTimeout(() => {
      this.clearActiveToast();
      this.showNextToast();
    }, ContractVarianceNotifierService.TOAST_DURATION_MS);
  }

  private clearActiveToast(): void {
    this.clearHideTimer();
    this.activeToastState.set(null);
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private isContractVarianceArgs(args: unknown[]): boolean {
    for (const arg of args) {
      const text = this.extractStringValue(arg)?.toLowerCase();
      if (!text) {
        continue;
      }

      if (
        text.includes('[ship-exterior-contract]') ||
        text.includes('[ship-exterior-launch-contract]') ||
        text.includes('[ship-inventory-contract]') ||
        text.includes('[socket-correlation]') ||
        text.includes('contract violation')
      ) {
        return true;
      }
    }

    return false;
  }

  private stringifyMessage(args: unknown[]): string {
    const parts = args.map((arg) => this.extractStringValue(arg)).filter((value): value is string => Boolean(value));
    if (parts.length === 0) {
      return 'Contract variance warning';
    }
    return parts.join(' ');
  }

  private extractStringValue(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    try {
      const serialized = JSON.stringify(value);
      if (!serialized) {
        return null;
      }
      return serialized;
    } catch {
      return null;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }
}
