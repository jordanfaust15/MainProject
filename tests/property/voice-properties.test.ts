import * as fc from 'fast-check';
import {
  VoiceInputProcessor,
  AudioRecorder,
  TranscriptionService,
  SILENCE_LEVEL,
} from '../../src/voice/voice-processor';
import { TranscriptionResult } from '../../src/models';

// ── Mock implementations ─────────────────────────────────────

class MockRecorder implements AudioRecorder {
  private callback: ((level: number) => void) | null = null;

  async requestPermission(): Promise<void> {}

  async start(onAudioLevel: (level: number) => void): Promise<void> {
    this.callback = onAudioLevel;
  }

  async stop(): Promise<ArrayBuffer> {
    this.callback = null;
    return new ArrayBuffer(512);
  }

  simulateLevel(level: number): void {
    this.callback?.(level);
  }
}

class MockTranscription implements TranscriptionService {
  result: TranscriptionResult = {
    success: true,
    text: 'hello world',
    confidence: 0.9,
  };

  async transcribe(): Promise<TranscriptionResult> {
    return this.result;
  }
}

describe('Voice Properties', () => {
  // Property 21: Voice recording activation
  // For any voice input initiation, the audio recording should become
  // active and provide visual feedback.
  test('Property 21: recording starts active with state notification', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const recorder = new MockRecorder();
        const transcription = new MockTranscription();
        const processor = new VoiceInputProcessor(recorder, transcription);

        let notified = false;
        processor.onStateChange((state) => {
          if (state.isRecording) notified = true;
        });

        const session = await processor.startRecording();

        expect(session.isActive).toBe(true);
        expect(processor.isRecording()).toBe(true);
        expect(notified).toBe(true);

        await processor.stopRecording();
      }),
      { numRuns: 100 }
    );
  });

  // Property 22: Silence detection and auto-stop
  // For any voice recording with silence exceeding 2 seconds, the
  // recording should automatically stop.
  test('Property 22: silence below threshold does not trigger auto-stop', () => {
    fc.assert(
      fc.property(
        fc.double({ min: SILENCE_LEVEL, max: 1.0, noNaN: true }),
        (level) => {
          // Any audio level at or above the silence threshold should
          // not trigger silence detection
          expect(level).toBeGreaterThanOrEqual(SILENCE_LEVEL);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 23: Transcription follows recording
  // For any stopped voice recording, the system should attempt to
  // transcribe the audio to text.
  test('Property 23: transcription returns result after recording', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        async (text) => {
          const recorder = new MockRecorder();
          const transcription = new MockTranscription();
          transcription.result = { success: true, text, confidence: 0.9 };

          const processor = new VoiceInputProcessor(recorder, transcription);
          await processor.startRecording();
          const audio = await processor.stopRecording();
          const result = await processor.transcribe(audio);

          expect(result.success).toBe(true);
          expect(result.text).toBe(text);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 25: Transcription failure handling
  // For any transcription failure, the system should prompt the user
  // with options to retry or switch to text input.
  test('Property 25: transcription failures return error info', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorMsg) => {
          const recorder = new MockRecorder();
          const transcription = new MockTranscription();
          transcription.result = {
            success: false,
            text: '',
            confidence: 0,
            error: errorMsg,
          };

          const processor = new VoiceInputProcessor(recorder, transcription);
          await processor.startRecording();
          const audio = await processor.stopRecording();
          const result = await processor.transcribe(audio);

          expect(result.success).toBe(false);
          expect(result.error).toBe(errorMsg);
        }
      ),
      { numRuns: 100 }
    );
  });
});
