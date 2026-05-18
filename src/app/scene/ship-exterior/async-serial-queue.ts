/**
 * Minimal async serial queue: processes items one at a time via the provided
 * processor and supports optional in-queue deduplication. Used by the ship
 * exterior scene to serialize celestial-body upserts and mission-progress sync
 * requests without writing the queue plumbing twice.
 */
export class AsyncSerialQueue<T> {
  private queue: T[] = [];
  private inFlightFlag = false;

  constructor(private readonly processor: (item: T) => Promise<void>) {}

  /**
   * Enqueues an item. When `isDuplicate` is supplied and matches an item
   * already queued (not yet started), the new item is dropped.
   */
  enqueue(item: T, isDuplicate?: (existing: T) => boolean): void {
    if (isDuplicate && this.queue.some(isDuplicate)) {
      return;
    }
    this.queue.push(item);
    void this.drain();
  }

  /** True when an item is currently being processed. */
  get inFlight(): boolean {
    return this.inFlightFlag;
  }

  /** Number of items waiting in the queue (excluding the in-flight item). */
  get queued(): number {
    return this.queue.length;
  }

  /** True when there is either an in-flight or queued item. */
  get hasPending(): boolean {
    return this.inFlightFlag || this.queue.length > 0;
  }

  private async drain(): Promise<void> {
    if (this.inFlightFlag) {
      return;
    }
    const item = this.queue.shift();
    if (!item) {
      return;
    }
    this.inFlightFlag = true;
    try {
      await this.processor(item);
    } catch (error) {
      console.error('[AsyncSerialQueue] Processor failed:', error);
    } finally {
      this.inFlightFlag = false;
      if (this.queue.length > 0) {
        void this.drain();
      }
    }
  }
}
