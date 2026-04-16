import { SessionService } from './session.service';

describe('SessionService', () => {
	let service: SessionService;

	beforeEach(() => {
		service = new SessionService();
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should initialize with no session', () => {
		expect(service.hasSession()).toBe(false);
		expect(service.getSessionKey()).toBeNull();
	});

	it('should store a session key', () => {
		service.setSessionKey('abc-123');
		expect(service.hasSession()).toBe(true);
		expect(service.getSessionKey()).toBe('abc-123');
	});

	it('should clear a session', () => {
		service.setSessionKey('abc-123');
		service.clearSession();
		expect(service.hasSession()).toBe(false);
		expect(service.getSessionKey()).toBeNull();
	});

	it('should overwrite an existing session key', () => {
		service.setSessionKey('key-1');
		service.setSessionKey('key-2');
		expect(service.getSessionKey()).toBe('key-2');
	});
});
