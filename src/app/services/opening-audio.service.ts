import { Injectable, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class OpeningAudioService {
	private audioContext: AudioContext | null = null;
	private armed = signal(false);
	private masterGain: GainNode | null = null;
	private ambienceBus: GainNode | null = null;
	private fxBus: GainNode | null = null;
	private thrumOscillators: OscillatorNode[] = [];
	private thrumLfos: OscillatorNode[] = [];
	private breathingLoopId: number | null = null;
	private ambienceRunning = signal(false);

	isArmed(): boolean {
		return this.armed();
	}

	isCinematicBedRunning(): boolean {
		return this.ambienceRunning();
	}

	isSpeechSynthesisAvailable(): boolean {
		return typeof window !== 'undefined' && 'speechSynthesis' in window;
	}

	async armFromUserGesture(): Promise<boolean> {
		if (this.armed()) {
			return true;
		}

		if (typeof window === 'undefined') {
			return false;
		}

		const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctor) {
			return false;
		}

		this.audioContext = this.audioContext ?? new Ctor();
		if (this.audioContext.state === 'suspended') {
			await this.audioContext.resume();
		}
		this.initializeAudioGraph();

		this.armed.set(this.audioContext.state === 'running');
		return this.armed();
	}

	startCinematicBed(): boolean {
		if (!this.armed() || !this.audioContext) {
			return false;
		}
		if (this.ambienceRunning()) {
			return true;
		}

		this.ambienceRunning.set(true);
		this.startThrumLayer();
		this.startBreathingLayer();
		return true;
	}

	stopCinematicBed(): void {
		this.ambienceRunning.set(false);

		for (const osc of this.thrumOscillators) {
			try {
				osc.stop();
			} catch {
				// Oscillator may already be stopped.
			}
		}
		for (const lfo of this.thrumLfos) {
			try {
				lfo.stop();
			} catch {
				// Oscillator may already be stopped.
			}
		}
		this.thrumOscillators = [];
		this.thrumLfos = [];

		if (this.breathingLoopId !== null) {
			window.clearInterval(this.breathingLoopId);
			this.breathingLoopId = null;
		}
	}

	playBlackoutPulse(): boolean {
		return this.playTone(160, 0.32, 'triangle', 0.09);
	}

	playHudFlicker(): boolean {
		const first = this.playTone(360, 0.06, 'sawtooth', 0.022);
		const second = this.playTone(220, 0.07, 'square', 0.017, 0.08);
		const third = this.playNoiseBurst(0.06, 0.025, 0.05);
		const fourth = this.playNoiseBurst(0.04, 0.02, 0.13);
		return first || second || third || fourth;
	}

	playAiTransmissionLine(line: string): boolean {
		if (!this.armed()) {
			return false;
		}

		let started = false;
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			const utterance = new SpeechSynthesisUtterance(line);
			utterance.rate = 0.92;
			utterance.pitch = 0.72;
			utterance.volume = 0.82;
			window.speechSynthesis.cancel();
			window.speechSynthesis.speak(utterance);
			started = true;
		}

		const shimmerA = this.playTone(240, 0.42, 'sawtooth', 0.02);
		const shimmerB = this.playTone(320, 0.37, 'square', 0.016, 0.05);
		const staticTail = this.playNoiseBurst(0.25, 0.018, 0.02);
		return started || shimmerA || shimmerB || staticTail;
	}

	playAiAwakening(): boolean {
		const first = this.playTone(420, 0.15, 'triangle', 0.05);
		const second = this.playTone(310, 0.25, 'triangle', 0.042, 0.14);
		const staticTail = this.playNoiseBurst(0.16, 0.02, 0.04);
		return first || second || staticTail;
	}

	private initializeAudioGraph(): void {
		if (!this.audioContext || this.masterGain) {
			return;
		}

		const compressor = this.audioContext.createDynamicsCompressor();
		compressor.threshold.value = -24;
		compressor.knee.value = 18;
		compressor.ratio.value = 3;
		compressor.attack.value = 0.01;
		compressor.release.value = 0.18;

		this.masterGain = this.audioContext.createGain();
		this.masterGain.gain.value = 0.78;
		this.ambienceBus = this.audioContext.createGain();
		this.ambienceBus.gain.value = 0.72;
		this.fxBus = this.audioContext.createGain();
		this.fxBus.gain.value = 0.88;

		this.ambienceBus.connect(this.masterGain);
		this.fxBus.connect(this.masterGain);
		this.masterGain.connect(compressor);
		compressor.connect(this.audioContext.destination);
	}

	private startThrumLayer(): void {
		if (!this.audioContext || !this.ambienceBus) {
			return;
		}

		const now = this.audioContext.currentTime;
		const base = this.audioContext.createOscillator();
		base.type = 'sine';
		base.frequency.setValueAtTime(94, now);

		const harmonic = this.audioContext.createOscillator();
		harmonic.type = 'triangle';
		harmonic.frequency.setValueAtTime(188, now);

		const driveGain = this.audioContext.createGain();
		driveGain.gain.value = 0.065;

		const harmonicGain = this.audioContext.createGain();
		harmonicGain.gain.value = 0.036;

		const lowpass = this.audioContext.createBiquadFilter();
		lowpass.type = 'lowpass';
		lowpass.frequency.value = 320;
		lowpass.Q.value = 0.8;

		const lfo = this.audioContext.createOscillator();
		lfo.type = 'sine';
		lfo.frequency.value = 0.27;
		const lfoDepth = this.audioContext.createGain();
		lfoDepth.gain.value = 48;
		lfo.connect(lfoDepth);
		lfoDepth.connect(lowpass.frequency);

		base.connect(driveGain);
		harmonic.connect(harmonicGain);
		driveGain.connect(lowpass);
		harmonicGain.connect(lowpass);
		lowpass.connect(this.ambienceBus);

		base.start(now);
		harmonic.start(now);
		lfo.start(now);

		this.thrumOscillators.push(base, harmonic);
		this.thrumLfos.push(lfo);
	}

	private startBreathingLayer(): void {
		if (!this.audioContext || !this.ambienceBus || this.breathingLoopId !== null) {
			return;
		}

		this.scheduleBreath();
		this.breathingLoopId = window.setInterval(() => {
			if (this.ambienceRunning()) {
				this.scheduleBreath();
			}
		}, 3850);
	}

	private scheduleBreath(): void {
		if (!this.audioContext || !this.ambienceBus) {
			return;
		}

		const duration = 2.6;
		const burst = this.createNoiseSource();
		const bandpass = this.audioContext.createBiquadFilter();
		bandpass.type = 'bandpass';
		bandpass.frequency.value = 1200;
		bandpass.Q.value = 0.55;

		const gainNode = this.audioContext.createGain();
		const now = this.audioContext.currentTime;
		gainNode.gain.setValueAtTime(0.0001, now);
		gainNode.gain.exponentialRampToValueAtTime(0.03, now + 0.38);
		gainNode.gain.exponentialRampToValueAtTime(0.014, now + 1.25);
		gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

		burst.source.connect(bandpass);
		bandpass.connect(gainNode);
		gainNode.connect(this.ambienceBus);

		burst.source.start(now);
		burst.source.stop(now + duration + 0.02);
	}

	private playNoiseBurst(durationSeconds: number, gainValue: number, delaySeconds = 0): boolean {
		if (!this.armed() || !this.audioContext || !this.fxBus) {
			return false;
		}

		const burst = this.createNoiseSource();
		const highpass = this.audioContext.createBiquadFilter();
		highpass.type = 'highpass';
		highpass.frequency.value = 1200;

		const gainNode = this.audioContext.createGain();
		const startAt = this.audioContext.currentTime + delaySeconds;
		const stopAt = startAt + durationSeconds;
		gainNode.gain.setValueAtTime(0.0001, startAt);
		gainNode.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.008);
		gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

		burst.source.connect(highpass);
		highpass.connect(gainNode);
		gainNode.connect(this.fxBus);
		burst.source.start(startAt);
		burst.source.stop(stopAt + 0.015);
		return true;
	}

	private createNoiseSource(): { source: AudioBufferSourceNode } {
		const sampleRate = this.audioContext?.sampleRate ?? 48000;
		const buffer = this.audioContext!.createBuffer(1, sampleRate, sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < data.length; i++) {
			data[i] = Math.random() * 2 - 1;
		}
		const source = this.audioContext!.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		return { source };
	}

	private playTone(
		frequency: number,
		durationSeconds: number,
		type: OscillatorType,
		gainValue: number,
		delaySeconds = 0,
	): boolean {
		if (!this.armed() || !this.audioContext || !this.fxBus) {
			return false;
		}

		const startAt = this.audioContext.currentTime + delaySeconds;
		const stopAt = startAt + durationSeconds;
		const oscillator = this.audioContext.createOscillator();
		const gainNode = this.audioContext.createGain();

		oscillator.type = type;
		oscillator.frequency.setValueAtTime(frequency, startAt);
		gainNode.gain.setValueAtTime(0.0001, startAt);
		gainNode.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
		gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

		oscillator.connect(gainNode);
		gainNode.connect(this.fxBus);
		oscillator.start(startAt);
		oscillator.stop(stopAt + 0.01);
		return true;
	}
}
