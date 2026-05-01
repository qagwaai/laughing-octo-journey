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

	describe('active ship', () => {
		const ship = { id: 'd-1', name: 'Surveyor', model: 'Scavenger Pod', tier: 1, status: 'ACTIVE' };

		it('should initialize with no active ship', () => {
			expect(service.activeShip()).toBeNull();
		});

		it('should store an active ship', () => {
			service.setActiveShip(ship as never);
			expect(service.activeShip()?.id).toBe('d-1');
			expect(service.activeShip()?.name).toBe('Surveyor');
		});

		it('should overwrite active ship when set again', () => {
			const other = { ...ship, id: 'd-2', name: 'Guardian' };
			service.setActiveShip(ship as never);
			service.setActiveShip(other as never);
			expect(service.activeShip()?.id).toBe('d-2');
			expect(service.activeShip()?.name).toBe('Guardian');
		});

		it('should clear active ship independently', () => {
			service.setActiveShip(ship as never);
			service.clearActiveShip();
			expect(service.activeShip()).toBeNull();
		});

		it('should clear active ship when clearSession is called', () => {
			service.setSessionKey('key-1');
			service.setActiveShip(ship as never);
			service.clearSession();
			expect(service.activeShip()).toBeNull();
			expect(service.hasSession()).toBe(false);
		});
	});
});
