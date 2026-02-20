import {
  VoiceInputProcessor,
  AudioRecorder,
  TranscriptionService,
  SILENCE_THRESHOLD_MS,
} from '../../src/voice/voice-processor';
import { TranscriptionResult } from '../../src/models';

// ── Mock implementations ─────────────────────────────────────

class MockRecorder implements AudioRecorder {
  private audioLevelCallback: ((level: number) => void) | null = null;
  permissionGranted = true;
  audioData = new ArrayBuffer(1024);

  async requestPermission(): Promise<void> {
    if (!this.permissionGranted) {
      throw new Error('Microphone access denied');
    }
  }

  async start(onAudioLevel: (level: number) => void): Promise<void> {
    this.audioLevelCallback = onAudioLevel;
  }

  async stop(): Promise<ArrayBuffer> {
    this.audioLevelCallback = null;
    return this.audioData;
  }

  /** Simulate audio level from test. */
  simulateAudioLevel(level: number): void {
    this.audioLevelCallback?.(level);
  }
}

class MockTranscriptionService implements TranscriptionService {
  result: TranscriptionResult = {
    success: true,
    text: 'test transcription',
    confidence: 0.95,
  };

  async transcribe(_audio: ArrayBuffer): Promise<TranscriptionResult> {
    return this.result;
  }
}

describe('VoiceInputProcessor', () => {
  let recorder: MockRecorder;
  let transcription: MockTranscriptionService;
  let processor: VoiceInputProcessor;

  beforeEach(() => {
    recorder = new MockRecorder();
    transcription = new MockTranscriptionService();
    processor = new VoiceInputProcessor(recorder, transcription);
  });

  // ── Property 21: Voice recording activation ────────────────
  // For any voice input initiation, the audio recording should become
  // active and provide visual feedback.

  test('startRecording creates active session', async () => {
    const session = await processor.startRecording();

    expect(session.id).toBeDefined();
    expect(session.startTime).toBeInstanceOf(Date);
    expect(session.isActive).toBe(true);
    expect(processor.isRecording()).toBe(true);

    await processor.stopRecording();
  });

  test('startRecording notifies state listeners', async () => {
    const states: { isRecording: boolean; audioLevel: number }[] = [];
    processor.onStateChange((state) => states.push(state));

    await processor.startRecording();

    expect(states.length).toBeGreaterThan(0);
    expect(states[0].isRecording).toBe(true);

    await processor.stopRecording();
  });

  test('startRecording throws if microphone denied', async () => {
    recorder.permissionGranted = false;

    await expect(processor.startRecording()).rejects.toThrow(
      'Microphone access denied'
    );
  });

  // ── Property 22: Silence detection and auto-stop ───────────
  // For any voice recording with silence exceeding 2 seconds, the
  // recording should automatically stop.

  test('auto-stops after 2 seconds of silence', async () => {
    jest.useFakeTimers();

    await processor.startRecording();
    expect(processor.isRecording()).toBe(true);

    // Simulate silence
    recorder.simulateAudioLevel(0.001);

    // Advance past silence threshold
    jest.advanceTimersByTime(SILENCE_THRESHOLD_MS + 100);

    // Give the async stop a tick
    await Promise.resolve();
    await Promise.resolve();

    expect(processor.isRecording()).toBe(false);

    jest.useRealTimers();
  });

  test('resets silence timer when sound resumes', async () => {
    jest.useFakeTimers();

    await processor.startRecording();

    // Simulate silence
    recorder.simulateAudioLevel(0.001);
    jest.advanceTimersByTime(1000); // 1s of silence

    // Sound resumes
    recorder.simulateAudioLevel(0.5);

    // More silence
    recorder.simulateAudioLevel(0.001);
    jest.advanceTimersByTime(1000); // Only 1s since reset

    // Should still be recording (haven't reached 2s continuous silence)
    expect(processor.isRecording()).toBe(true);

    await processor.stopRecording();
    jest.useRealTimers();
  });

  // ── Property 23: Transcription follows recording ───────────
  // For any stopped voice recording, the system should attempt to
  // transcribe the audio to text.

  test('transcribes audio after recording stops', async () => {
    await processor.startRecording();
    const audio = await processor.stopRecording();

    const result = await processor.transcribe(audio);

    expect(result.success).toBe(true);
    expect(result.text).toBe('test transcription');
    expect(result.confidence).toBe(0.95);
  });

  // ── Property 24: Context extraction follows transcription ──
  // (This is tested at the Capture Module integration level)

  // ── Property 25: Transcription failure handling ────────────
  // For any transcription failure, the system should prompt the user
  // with options to retry or switch to text input.

  test('returns failure result on transcription error', async () => {
    transcription.result = {
      success: false,
      text: '',
      confidence: 0,
      error: 'Network error',
    };

    await processor.startRecording();
    const audio = await processor.stopRecording();
    const result = await processor.transcribe(audio);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  test('returns low confidence result for review', async () => {
    transcription.result = {
      success: true,
      text: 'partial transcription',
      confidence: 0.4,
    };

    await processor.startRecording();
    const audio = await processor.stopRecording();
    const result = await processor.transcribe(audio);

    expect(result.success).toBe(true);
    expect(result.confidence).toBeLessThan(0.7);
  });

  // ── Manual stop ────────────────────────────────────────────

  test('stopRecording returns audio data', async () => {
    await processor.startRecording();
    const audio = await processor.stopRecording();

    expect(audio).toBeInstanceOf(ArrayBuffer);
    expect(audio.byteLength).toBeGreaterThan(0);
  });

  test('stopRecording marks session as inactive', async () => {
    const session = await processor.startRecording();
    await processor.stopRecording();

    expect(session.isActive).toBe(false);
    expect(processor.isRecording()).toBe(false);
  });

  test('stopRecording throws if no active session', async () => {
    await expect(processor.stopRecording()).rejects.toThrow(
      'No active recording session'
    );
  });

  // ── Audio level feedback ───────────────────────────────────

  test('notifies listeners of audio levels during recording', async () => {
    const levels: number[] = [];
    processor.onStateChange((state) => {
      if (state.isRecording) levels.push(state.audioLevel);
    });

    await processor.startRecording();
    recorder.simulateAudioLevel(0.3);
    recorder.simulateAudioLevel(0.7);
    recorder.simulateAudioLevel(0.1);

    // Initial notification + 3 level updates
    expect(levels.length).toBeGreaterThanOrEqual(3);

    await processor.stopRecording();
  });
});
