interface HoverScannableSample {
  id: string;
  scanned: boolean;
}

export interface AsteroidScanContext {
  contextKey: string;
  getScannableSamples(): readonly HoverScannableSample[];
}

export interface AsteroidScanControllerDeps {
  getActiveContext: () => AsteroidScanContext | null;
  getContext: (contextKey: string) => AsteroidScanContext | null;
  onScanComplete: (contextKey: string, sampleId: string) => void;
  resolveHoldMs: () => number;
}

export class AsteroidScanController {
  private candidateId: string | null = null;
  private contextKey: string | null = null;
  private timeoutId: number | null = null;

  constructor(private readonly deps: AsteroidScanControllerDeps) {}

  beginHoverScan(sampleId: string): boolean {
    const active = this.deps.getActiveContext();
    if (!active) {
      return false;
    }

    const sample = active.getScannableSamples().find((candidate) => candidate.id === sampleId);
    if (!sample || sample.scanned) {
      this.clearHoverScanTimer();
      return false;
    }

    this.clearHoverScanTimer();
    this.candidateId = sampleId;
    this.contextKey = active.contextKey;
    this.timeoutId = window.setTimeout(() => {
      if (this.candidateId === sampleId) {
        const contextKey = this.contextKey;
        if (contextKey) {
          this.deps.onScanComplete(contextKey, sampleId);
        }
      }
      this.clearHoverScanTimer();
    }, this.deps.resolveHoldMs());

    return true;
  }

  clearHoverScanTimer(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.candidateId = null;
    this.contextKey = null;
  }

  syncFromHover(contextKey: string | null, hoveredAsteroidId: string | null): void {
    if (!contextKey) {
      this.clearHoverScanTimer();
      return;
    }

    if (!hoveredAsteroidId) {
      if (this.contextKey === contextKey) {
        this.clearHoverScanTimer();
      }
      return;
    }

    if (this.contextKey !== contextKey || this.candidateId !== hoveredAsteroidId) {
      this.beginHoverScan(hoveredAsteroidId);
    }
  }

  dispose(): void {
    this.clearHoverScanTimer();
  }
}
