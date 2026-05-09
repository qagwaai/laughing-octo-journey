import { AsyncSerialQueue } from './async-serial-queue';

describe('AsyncSerialQueue', () => {
  it('processes items serially in FIFO order', async () => {
    const order: number[] = [];
    const resolvers: Array<() => void> = [];
    const queue = new AsyncSerialQueue<number>(
      (item) =>
        new Promise<void>((resolve) => {
          order.push(item);
          resolvers.push(resolve);
        }),
    );
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    expect(order).toEqual([1]);
    expect(queue.inFlight).toBeTrue();
    expect(queue.queued).toBe(2);

    resolvers.shift()!();
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([1, 2]);

    resolvers.shift()!();
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([1, 2, 3]);

    resolvers.shift()!();
    await Promise.resolve();
    await Promise.resolve();
    expect(queue.hasPending).toBeFalse();
  });

  it('drops duplicates when isDuplicate matches a queued item', async () => {
    const processed: string[] = [];
    let firstResolver: (() => void) | null = null;
    const queue = new AsyncSerialQueue<string>(
      (item) =>
        new Promise<void>((resolve) => {
          processed.push(item);
          if (firstResolver === null) {
            firstResolver = resolve;
          } else {
            resolve();
          }
        }),
    );
    queue.enqueue('a');
    queue.enqueue('b');
    queue.enqueue('b', (existing) => existing === 'b');
    queue.enqueue('c');

    firstResolver!();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(processed).toEqual(['a', 'b', 'c']);
  });

  it('continues processing after a processor rejection', async () => {
    const processed: number[] = [];
    const queue = new AsyncSerialQueue<number>(async (item) => {
      processed.push(item);
      if (item === 1) {
        throw new Error('boom');
      }
    });
    queue.enqueue(1);
    queue.enqueue(2);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(processed).toEqual([1, 2]);
    expect(queue.hasPending).toBeFalse();
  });
});
