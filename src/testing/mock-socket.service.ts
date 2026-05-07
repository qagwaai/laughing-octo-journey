/**
 * Canonical MockSocketService for use in spec files.
 * Typed to match the public surface of SocketService.
 *
 * Usage:
 *   import { createMockSocketService, MockSocketService } from '../../../testing';
 *   let socket: MockSocketService;
 *   beforeEach(() => { socket = createMockSocketService(); });
 *   // Simulate an inbound event:
 *   socket.triggerEvent('my-event', payload);
 *   socket.triggerOnceEvent('my-once-event', payload);
 */
export interface MockSocketService {
	/** All calls to emit(), in order. */
	emittedEvents: Array<{ event: string; data: any }>;
	/** Active on() listeners, keyed by event name. */
	registeredListeners: Map<string, (data: any) => void>;
	/** Active once() listeners, keyed by event name. */
	onceListeners: Map<string, (data?: any) => void>;
	/** Mutable flag — set to true to simulate a connected socket. */
	connected: boolean;

	emit(event: string, data?: any): void;
	on(event: string, cb: (data: any) => void): () => void;
	once(event: string, cb: (data?: any) => void): void;
	getIsConnected(): boolean;

	/** Invoke the registered on() callback for the given event. */
	triggerEvent(event: string, data: any): void;
	/** Invoke and clear the registered once() callback for the given event. */
	triggerOnceEvent(event: string, data?: any): void;
	/** Alias for triggerOnceEvent — kept for backward compatibility with older specs. */
	triggerOnce(event: string, data?: any): void;
}

export function createMockSocketService(): MockSocketService {
	const emittedEvents: Array<{ event: string; data: any }> = [];
	const registeredListeners = new Map<string, (data: any) => void>();
	const onceListeners = new Map<string, (data?: any) => void>();

	return {
		emittedEvents,
		registeredListeners,
		onceListeners,
		connected: false,
		emit(event: string, data?: any) {
			emittedEvents.push({ event, data });
		},
		on(event: string, cb: (data: any) => void) {
			registeredListeners.set(event, cb);
			return () => registeredListeners.delete(event);
		},
		once(event: string, cb: (data?: any) => void) {
			onceListeners.set(event, cb);
		},
		getIsConnected() {
			return this.connected;
		},
		triggerEvent(event: string, data: any) {
			registeredListeners.get(event)?.(data);
		},
		triggerOnceEvent(event: string, data?: any) {
			const cb = onceListeners.get(event);
			if (cb) {
				onceListeners.delete(event);
				cb(data);
			}
		},
		triggerOnce(event: string, data?: any) {
			const cb = onceListeners.get(event);
			if (cb) {
				onceListeners.delete(event);
				cb(data);
			}
		},
	};
}
