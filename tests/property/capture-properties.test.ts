import * as fc from 'fast-check';
import { CaptureModule } from '../../src/lib/capture/capture-module';
import { ContextExtractor } from '../../src/lib/extraction/context-extractor';
import {
  VoiceInputProcessor,
  AudioRecorder,
  TranscriptionService,
} from '../../src/lib/voice/voice-processor';
import { SessionManager } from '../../src/lib/session/session-manager';
import { MockDataStore } from '../helpers/mock-data-store';
import { TranscriptionResult } from '../../src/lib/models';

// ── Mocks ────────────────────────────────────────────────────

class MockRecorder implements AudioRecorder {
  async requestPermission(): Promise<void> {}
  async start(): Promise<void> {}
  async stop(): Promise<ArrayBuffer> {
    return new ArrayBuffer(512);
  }
}

class MockTranscription implements TranscriptionService {
  text = 'transcribed text';

  async transcribe(): Promise<TranscriptionResult> {
    return { success: true, text: this.text, confidence: 0.9 };
  }
}

function setup() {
  const store = new MockDataStore();
  const sessionManager = new SessionManager(store);
  const extractor = new ContextExtractor();
  const mockTranscription = new MockTranscription();
  const voiceProcessor = new VoiceInputProcessor(
    new MockRecorder(),
    mockTranscription
  );
  const captureModule = new CaptureModule(
    extractor,
    voiceProcessor,
    sessionManager,
    store
  );
  return { store, sessionManager, extractor, captureModule, mockTranscription };
}

describe('Capture Properties', () => {
  // Property 1: Capture accepts both input modalities
  // For any capture (quick or interrupt), the system should accept both
  // voice input and text input as valid input methods.
  test('Property 1: both text and voice input are accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom('quick' as const, 'interrupt' as const),
        async (text, type) => {
          const { store, sessionManager, captureModule, mockTranscription } = setup();
          mockTranscription.text = text;

          const session = await sessionManager.createSession('proj-1');
          const capSession =
            type === 'quick'
              ? captureModule.startQuickCapture(session.id)
              : captureModule.startInterruptCapture(session.id);

          // Text input
          const textResult = await captureModule.submitTextCapture(
            capSession,
            text
          );
          expect(textResult.success).toBe(true);

          // Voice input
          const voiceResult = await captureModule.submitVoiceCapture(
            capSession,
            new ArrayBuffer(512)
          );
          expect(voiceResult.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 2: Quick capture completes within time constraint
  // For any quick capture operation, the time from initiation to
  // completion should not exceed 30 seconds.
  test('Property 2: quick capture completes well under 30s', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        async (text) => {
          const { store, sessionManager, captureModule } = setup();
          const session = await sessionManager.createSession('proj-1');

          const start = Date.now();
          const capSession = captureModule.startQuickCapture(session.id);
          await captureModule.submitTextCapture(capSession, text);
          const duration = Date.now() - start;

          expect(duration).toBeLessThan(30_000);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 4: Captures are associated with sessions
  // For any completed capture, the capture should be associated with
  // the current session ID.
  test('Property 4: captures are associated with their session', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (projectId, text) => {
          const { store, sessionManager, captureModule } = setup();
          const session = await sessionManager.createSession(projectId);
          const capSession = captureModule.startQuickCapture(session.id);

          const result = await captureModule.submitTextCapture(
            capSession,
            text
          );

          const capture = await store.getCapture(result.captureId);
          expect(capture).not.toBeNull();
          expect(capture!.sessionId).toBe(session.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 5: Exit timestamps are recorded
  // For any completed capture, the system should record an exit
  // timestamp for the associated session.
  test('Property 5: exit timestamp is recorded after capture', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (projectId, text) => {
          const { store, sessionManager, captureModule } = setup();
          const session = await sessionManager.createSession(projectId);
          const capSession = captureModule.startQuickCapture(session.id);

          await captureModule.submitTextCapture(capSession, text);

          const updated = await store.getSession(session.id);
          expect(updated).not.toBeNull();
          expect(updated!.exitTime).toBeDefined();
          expect(updated!.exitTime).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6: Interrupt capture is accessible within time constraint
  // For any interrupt capture initiation, the capture interface should
  // become accessible within 2 seconds.
  test('Property 6: interrupt capture starts in under 2s', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (projectId) => {
        const { sessionManager, captureModule } = setup();
        const session = await sessionManager.createSession(projectId);

        const start = Date.now();
        const capSession = captureModule.startInterruptCapture(session.id);
        const duration = Date.now() - start;

        expect(capSession).toBeDefined();
        expect(capSession.type).toBe('interrupt');
        expect(duration).toBeLessThan(2_000);
      }),
      { numRuns: 100 }
    );
  });

  // Property 7: Interrupt capture processes single sentence input
  // For any single sentence input provided to interrupt capture, the
  // system should accept and process it for context extraction.
  test('Property 7: interrupt capture processes single sentence', async () => {
    const sentences = [
      'Debugging the login bug.',
      'Working on the API endpoint.',
      'Blocked on the database schema.',
      'Need to fix the timeout issue.',
      'Just finished the migration.',
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...sentences),
        async (sentence) => {
          const { store, sessionManager, captureModule } = setup();
          const session = await sessionManager.createSession('proj-1');
          const capSession = captureModule.startInterruptCapture(session.id);

          const result = await captureModule.submitTextCapture(
            capSession,
            sentence
          );

          expect(result.success).toBe(true);
          expect(result.originalInput).toBe(sentence);
          expect(result.extractedContext).toBeDefined();
          expect(result.extractedContext.originalInput).toBe(sentence);
        }
      ),
      { numRuns: 100 }
    );
  });
});
