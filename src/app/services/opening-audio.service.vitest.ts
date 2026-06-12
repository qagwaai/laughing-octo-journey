import { OpeningAudioService } from './opening-audio.service';

describe('OpeningAudioService', () => {
  class MockAudioParam {
    value = 0;
    setValueAtTime = vi.fn((value: number) => {
      this.value = value;
    });
    exponentialRampToValueAtTime = vi.fn((value: number) => {
      this.value = value;
    });
  }

  class MockGainNode {
    gain = new MockAudioParam();
    connect = vi.fn();
  }

  class MockOscillatorNode {
    type: OscillatorType = 'sine';
    frequency = new MockAudioParam();
    connect = vi.fn();
    start = vi.fn();
    stop = vi.fn();
  }

  class MockBiquadFilterNode {
    type: BiquadFilterType = 'lowpass';
    frequency = new MockAudioParam();
    Q = new MockAudioParam();
    connect = vi.fn();
  }

  class MockDynamicsCompressorNode {
    threshold = new MockAudioParam();
    knee = new MockAudioParam();
    ratio = new MockAudioParam();
    attack = new MockAudioParam();
    release = new MockAudioParam();
    connect = vi.fn();
  }

  class MockAudioBuffer {
    private readonly data = new Float32Array(16);

    getChannelData = vi.fn().mockReturnValue(this.data);
  }

  class MockAudioBufferSourceNode {
    buffer: MockAudioBuffer | null = null;
    loop = false;
    connect = vi.fn();
    start = vi.fn();
    stop = vi.fn();
  }

  class MockAudioContext {
    static instances: MockAudioContext[] = [];

    state: AudioContextState = 'running';
    currentTime = 12;
    sampleRate = 48000;
    destination = {} as AudioDestinationNode;
    resume = vi.fn(async () => {
      this.state = 'running';
    });
    createDynamicsCompressor = vi.fn(
      () => new MockDynamicsCompressorNode() as unknown as DynamicsCompressorNode,
    );
    createGain = vi.fn(() => new MockGainNode() as unknown as GainNode);
    createOscillator = vi.fn(() => new MockOscillatorNode() as unknown as OscillatorNode);
    createBiquadFilter = vi.fn(() => new MockBiquadFilterNode() as unknown as BiquadFilterNode);
    createBuffer = vi.fn(() => new MockAudioBuffer() as unknown as AudioBuffer);
    createBufferSource = vi.fn(() => new MockAudioBufferSourceNode() as unknown as AudioBufferSourceNode);

    constructor() {
      MockAudioContext.instances.push(this);
    }
  }

  class MockSpeechSynthesisUtterance {
    rate = 1;
    pitch = 1;
    volume = 1;

    constructor(public readonly text: string) {}
  }

  let service: OpeningAudioService;
  let originalAudioContext: typeof window.AudioContext | undefined;
  let originalWebkitAudioContext: typeof window.AudioContext | undefined;
  let originalSpeechSynthesis: SpeechSynthesis | undefined;
  let originalSpeechSynthesisUtterance: typeof SpeechSynthesisUtterance | undefined;
  let setIntervalSpy: ReturnType<typeof vi.spyOn>;
  let clearIntervalSpy: ReturnType<typeof vi.spyOn>;
  let capturedInterval: (() => void) | null;
  let intervalHandle: ReturnType<typeof setInterval>;

  const assignAudioContextCtor = (ctor: typeof AudioContext | undefined): void => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: ctor,
    });
  };

  const assignWebkitAudioContextCtor = (ctor: typeof AudioContext | undefined): void => {
    Object.defineProperty(window as Window & { webkitAudioContext?: typeof AudioContext }, 'webkitAudioContext', {
      configurable: true,
      writable: true,
      value: ctor,
    });
  };

  const assignSpeechSynthesis = (speechSynthesis: SpeechSynthesis | undefined): void => {
    if (speechSynthesis === undefined) {
      delete (window as any).speechSynthesis;
      return;
    }

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: speechSynthesis,
    });
  };

  const assignSpeechSynthesisUtterance = (ctor: typeof SpeechSynthesisUtterance | undefined): void => {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      writable: true,
      value: ctor,
    });
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
      configurable: true,
      writable: true,
      value: ctor,
    });
  };

  const armService = async (state: AudioContextState = 'running'): Promise<MockAudioContext> => {
    assignAudioContextCtor(MockAudioContext as unknown as typeof AudioContext);
    await service.armFromUserGesture();
    const context = MockAudioContext.instances.at(-1)!;
    context.state = state;
    if (state === 'suspended') {
      await service.armFromUserGesture();
    }
    return MockAudioContext.instances.at(-1)!;
  };

  beforeEach(() => {
    originalAudioContext = window.AudioContext;
    originalWebkitAudioContext = (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    originalSpeechSynthesis = window.speechSynthesis;
    originalSpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
    MockAudioContext.instances = [];
    capturedInterval = null;
    intervalHandle = 321 as unknown as ReturnType<typeof setInterval>;
    setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler) => {
      capturedInterval = handler as () => void;
      return 321;
    }) as any);
    clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    assignAudioContextCtor(undefined);
    assignWebkitAudioContextCtor(undefined);
    assignSpeechSynthesis(undefined);
    assignSpeechSynthesisUtterance(MockSpeechSynthesisUtterance as unknown as typeof SpeechSynthesisUtterance);
    service = new OpeningAudioService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    assignAudioContextCtor(originalAudioContext);
    assignWebkitAudioContextCtor(originalWebkitAudioContext);
    assignSpeechSynthesis(originalSpeechSynthesis);
    assignSpeechSynthesisUtterance(originalSpeechSynthesisUtterance);
  });

  it('should initialize as disarmed', () => {
    expect(service.isArmed()).toBe(false);
  });

  it('should expose audio hooks disabled by default', () => {
    expect(service.isAudioHooksEnabled()).toBe(false);
  });

  it('should initialize with cinematic bed stopped', () => {
    expect(service.isCinematicBedRunning()).toBe(false);
  });

  it('should report speech synthesis availability as boolean', () => {
    expect(typeof service.isSpeechSynthesisAvailable()).toBe('boolean');
  });

  it('should report speech synthesis availability when present', () => {
    assignSpeechSynthesis({
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis);

    expect(service.isSpeechSynthesisAvailable()).toBe(true);
  });

  it('should install gesture hooks when audio hooks are enabled', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    service.setAudioHooksEnabled(true);

    expect(service.isAudioHooksEnabled()).toBe(true);
    expect(addEventListenerSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function), { passive: true });
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should remove gesture hooks and cancel speech when audio hooks are disabled', () => {
    const speechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis;
    assignSpeechSynthesis(speechSynthesis);
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    service.setAudioHooksEnabled(true);
    service.setAudioHooksEnabled(false);

    expect(service.isAudioHooksEnabled()).toBe(false);
    expect(speechSynthesis.cancel).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should not install gesture hooks when already armed', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    await armService();

    service.setAudioHooksEnabled(true);

    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it('should fail to arm when no audio context constructor is available', async () => {
    await expect(service.armFromUserGesture()).resolves.toBe(false);
    expect(service.isArmed()).toBe(false);
  });

  it('should arm and initialize the audio graph with AudioContext', async () => {
    assignAudioContextCtor(MockAudioContext as unknown as typeof AudioContext);

    await expect(service.armFromUserGesture()).resolves.toBe(true);

    const context = MockAudioContext.instances[0];
    expect(context).toBeDefined();
    expect(context.createDynamicsCompressor).toHaveBeenCalled();
    expect(context.createGain).toHaveBeenCalledTimes(3);
    expect(service.isArmed()).toBe(true);
  });

  it('should arm using the webkit audio context fallback', async () => {
    assignWebkitAudioContextCtor(MockAudioContext as unknown as typeof AudioContext);

    await expect(service.armFromUserGesture()).resolves.toBe(true);

    expect(MockAudioContext.instances.length).toBe(1);
    expect(service.isArmed()).toBe(true);
  });

  it('should resume a suspended audio context while arming', async () => {
    assignAudioContextCtor(MockAudioContext as unknown as typeof AudioContext);
    const context = new MockAudioContext();
    context.state = 'suspended';
    assignAudioContextCtor(function MockCtor(this: unknown) {
      return context;
    } as unknown as typeof AudioContext);

    await expect(service.armFromUserGesture()).resolves.toBe(true);

    expect(context.resume).toHaveBeenCalled();
    expect(service.isArmed()).toBe(true);
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

  it('should start cinematic bed once armed', async () => {
    const context = await armService();

    expect(service.startCinematicBed()).toBe(true);
    expect(service.isCinematicBedRunning()).toBe(true);
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    expect(context.createBiquadFilter).toHaveBeenCalledTimes(2);
    expect(context.createBufferSource).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalled();
  });

  it('should not duplicate the cinematic bed when already running', async () => {
    const context = await armService();

    expect(service.startCinematicBed()).toBe(true);
    expect(service.startCinematicBed()).toBe(true);
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should safely stop cinematic bed before arming', () => {
    expect(() => service.stopCinematicBed()).not.toThrow();
  });

  it('should stop the cinematic bed and clear scheduled layers', async () => {
    const context = await armService();
    service.startCinematicBed();

    service.stopCinematicBed();

    expect(service.isCinematicBedRunning()).toBe(false);
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalHandle);
    const createdOscillators = context.createOscillator.mock.results.map(
      (result) => result.value as unknown as MockOscillatorNode,
    );
    for (const oscillator of createdOscillators) {
      expect(oscillator.stop).toHaveBeenCalled();
    }
  });

  it('should schedule repeated breathing while the cinematic bed is running', async () => {
    const context = await armService();
    service.startCinematicBed();
    const initialBreaths = context.createBufferSource.mock.calls.length;

    capturedInterval?.();

    expect(context.createBufferSource.mock.calls.length).toBe(initialBreaths + 1);
  });

  it('should not play AI transmission line before arming', () => {
    expect(service.playAiTransmissionLine('Pilot status')).toBe(false);
  });

  it('should play blackout pulse once armed', async () => {
    const context = await armService();

    expect(service.playBlackoutPulse()).toBe(true);
    expect(context.createOscillator).toHaveBeenCalled();
  });

  it('should play HUD flicker layers once armed', async () => {
    const context = await armService();

    expect(service.playHudFlicker()).toBe(true);
    expect(context.createOscillator.mock.calls.length).toBe(2);
    expect(context.createBufferSource.mock.calls.length).toBe(2);
  });

  it('should play AI awakening layers once armed', async () => {
    const context = await armService();

    expect(service.playAiAwakening()).toBe(true);
    expect(context.createOscillator.mock.calls.length).toBe(2);
    expect(context.createBufferSource.mock.calls.length).toBe(1);
  });

  it('should play AI transmission with speech synthesis when available', async () => {
    const speechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis & { speak: ReturnType<typeof vi.fn> };
    assignSpeechSynthesis(speechSynthesis);
    const context = await armService();

    expect(service.playAiTransmissionLine('Wake up, pilot')).toBe(true);
    expect(speechSynthesis.cancel).toHaveBeenCalled();
    expect(speechSynthesis.speak).toHaveBeenCalled();
    const utterance = (speechSynthesis.speak as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as MockSpeechSynthesisUtterance;
    expect(utterance.text).toBe('Wake up, pilot');
    expect(utterance.rate).toBe(0.92);
    expect(utterance.pitch).toBe(0.72);
    expect(utterance.volume).toBe(0.82);
    expect(context.createOscillator.mock.calls.length).toBe(2);
    expect(context.createBufferSource.mock.calls.length).toBe(1);
  });

  it('should still play AI transmission effects without speech synthesis support', async () => {
    const context = await armService();

    expect(service.playAiTransmissionLine('Wake up, pilot')).toBe(true);
    expect(context.createOscillator.mock.calls.length).toBe(2);
    expect(context.createBufferSource.mock.calls.length).toBe(1);
  });
});