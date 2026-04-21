import { OpeningAudioService } from './opening-audio.service';

describe('OpeningAudioService', () => {
	let service: OpeningAudioService;

	beforeEach(() => {
		service = new OpeningAudioService();
	});

	it('should initialize as disarmed', () => {
		expect(service.isArmed()).toBe(false);
	});

	it('should not play blackout pulse before arming', () => {
		expect(service.playBlackoutPulse()).toBe(false);
	});

	it('should not play hud flicker before arming', () => {
		expect(service.playHudFlicker()).toBe(false);
	});

	it('should not play AI awakening before arming', () => {
		expect(service.playAiAwakening()).toBe(false);
	});

	it('should not start cinematic bed before arming', () => {
		expect(service.startCinematicBed()).toBe(false);
	});

	it('should safely stop cinematic bed before arming', () => {
		expect(() => service.stopCinematicBed()).not.toThrow();
	});

	it('should not play AI transmission line before arming', () => {
		expect(service.playAiTransmissionLine('Pilot status')).toBe(false);
	});
});
