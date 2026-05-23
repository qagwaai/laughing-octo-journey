export class TractorBeamAudioController {
  private audioContext: AudioContext | null = null;
  private loopGainNode: GainNode | null = null;
  private loopOscNodes: OscillatorNode[] = [];

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    this.audioContext = new AudioContextCtor();
    return this.audioContext;
  }

  startLoop(): void {
    const context = this.ensureAudioContext();
    if (!context || this.loopOscNodes.length > 0) {
      return;
    }

    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.06);
    gain.connect(context.destination);

    const low = context.createOscillator();
    low.type = 'sawtooth';
    low.frequency.setValueAtTime(86, now);
    low.detune.setValueAtTime(-8, now);

    const high = context.createOscillator();
    high.type = 'triangle';
    high.frequency.setValueAtTime(172, now);
    high.detune.setValueAtTime(6, now);

    low.connect(gain);
    high.connect(gain);
    low.start(now);
    high.start(now);

    this.loopGainNode = gain;
    this.loopOscNodes = [low, high];
  }

  stopLoop(): void {
    const context = this.audioContext;
    const gain = this.loopGainNode;
    if (!context || !gain || this.loopOscNodes.length === 0) {
      this.loopGainNode = null;
      this.loopOscNodes = [];
      return;
    }

    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    for (const oscillator of this.loopOscNodes) {
      oscillator.stop(now + 0.09);
    }

    this.loopOscNodes = [];
    this.loopGainNode = null;
  }

  playCompletionChime(): void {
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    gain.connect(context.destination);

    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(920, now + 0.2);
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  }

  dispose(): void {
    if (!this.audioContext) {
      return;
    }

    this.stopLoop();
    void this.audioContext.close();
    this.audioContext = null;
  }
}
