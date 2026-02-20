import { MockDataStore } from '../helpers/mock-data-store';
import { SessionManager } from '../../src/lib/session/session-manager';
import { ContextExtractor } from '../../src/lib/extraction/context-extractor';
import { CaptureModule } from '../../src/lib/capture/capture-module';
import { BriefingGenerator } from '../../src/lib/briefing/briefing-generator';
import {
  VoiceInputProcessor,
  AudioRecorder,
  TranscriptionService,
} from '../../src/lib/voice/voice-processor';
import { Capture, TranscriptionResult } from '../../src/lib/models';

class MockRecorder implements AudioRecorder {
  async requestPermission(): Promise<void> {}
  async start(): Promise<void> {}
  async stop(): Promise<ArrayBuffer> { return new ArrayBuffer(512); }
}

class MockTranscription implements TranscriptionService {
  async transcribe(): Promise<TranscriptionResult> {
    return { success: true, text: 'test transcription', confidence: 0.9 };
  }
}

function buildSystem() {
  const store = new MockDataStore();
  const sessionManager = new SessionManager(store);
  const extractor = new ContextExtractor();
  const voiceProcessor = new VoiceInputProcessor(new MockRecorder(), new MockTranscription());
  const captureModule = new CaptureModule(extractor, voiceProcessor, sessionManager, store);
  const briefingGenerator = new BriefingGenerator(store, sessionManager);
  return { store, sessionManager, extractor, captureModule, briefingGenerator };
}

describe('Performance: Timing Constraints', () => {
  // ── Quick capture: <30 seconds ─────────────────────────────

  test('quick capture end-to-end completes well under 30s', async () => {
    const { sessionManager, captureModule } = buildSystem();
    const session = await sessionManager.createSession('perf-project');

    const durations: number[] = [];
    for (let i = 0; i < 50; i++) {
      const start = Date.now();
      const capSession = captureModule.startQuickCapture(session.id);
      await captureModule.submitTextCapture(
        capSession,
        'I was working on the performance testing module. Found that the indexing was slow. Need to optimize the query. Next I should add caching.'
      );
      durations.push(Date.now() - start);
    }

    const maxDuration = Math.max(...durations);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    expect(maxDuration).toBeLessThan(30_000);
    expect(avgDuration).toBeLessThan(1000); // Should be well under 1s
  });

  // ── Interrupt capture: accessible <2 seconds ───────────────

  test('interrupt capture becomes accessible in <2s', async () => {
    const { sessionManager, captureModule } = buildSystem();
    const session = await sessionManager.createSession('perf-project');

    const durations: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      const capSession = captureModule.startInterruptCapture(session.id);
      durations.push(Date.now() - start);

      expect(capSession).toBeDefined();
      expect(capSession.type).toBe('interrupt');
    }

    const maxDuration = Math.max(...durations);
    expect(maxDuration).toBeLessThan(2_000);
  });

  // ── Briefing generation: <5 seconds ────────────────────────

  test('briefing generation completes in <5s', async () => {
    const { store, sessionManager, briefingGenerator } = buildSystem();
    const session = await sessionManager.createSession('perf-project');
    await sessionManager.closeSession(
      session.id,
      new Date(session.entryTime.getTime() + 3_600_000)
    );

    const capture: Capture = {
      id: 'perf-cap',
      sessionId: session.id,
      type: 'quick',
      originalInput: 'performance test input',
      contextElements: {
        intent: ['testing performance'],
        lastAction: ['set up benchmarks'],
        openLoops: ['verify under load'],
        nextAction: ['optimize hotspots'],
        originalInput: 'performance test input',
      },
      timestamp: new Date(),
    };
    await store.saveCapture(capture);
    const updated = await store.getSession(session.id);
    updated!.captureId = capture.id;
    await store.saveSession(updated!);

    const durations: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await briefingGenerator.generateBriefing(session.id);
      durations.push(Date.now() - start);
    }

    const maxDuration = Math.max(...durations);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    expect(maxDuration).toBeLessThan(5_000);
    expect(avgDuration).toBeLessThan(100); // Should be well under 100ms
  });

  // ── Context extraction performance ─────────────────────────

  test('context extraction handles large inputs quickly', () => {
    const { extractor } = buildSystem();

    // Generate a large input (multiple paragraphs)
    const largeInput = Array(50)
      .fill(
        'I was working on the authentication module. Found the token refresh bug. ' +
        'Need to check the session expiry logic. Next I should write integration tests. '
      )
      .join('\n');

    const start = Date.now();
    const result = extractor.extract(largeInput);
    const duration = Date.now() - start;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(1000); // Under 1s for large input
  });
});

describe('Performance: Load Testing', () => {
  // ── 1000+ sessions per project ─────────────────────────────

  test('handles 1000 sessions per project', async () => {
    const { store, sessionManager, briefingGenerator } = buildSystem();

    // Create 1000 sessions
    for (let i = 0; i < 1000; i++) {
      const session = await sessionManager.createSession('load-project');
      await sessionManager.closeSession(
        session.id,
        new Date(session.entryTime.getTime() + 60_000)
      );
    }

    // Briefing for most recent should still be fast
    const start = Date.now();
    const briefing = await briefingGenerator.generateBriefingForProject('load-project');
    const duration = Date.now() - start;

    expect(briefing).not.toBeNull();
    expect(duration).toBeLessThan(5_000);
  });

  // ── Session history retrieval at scale ─────────────────────

  test('session history retrieval stays fast with many sessions', async () => {
    const { sessionManager } = buildSystem();

    for (let i = 0; i < 500; i++) {
      await sessionManager.createSession('history-project');
    }

    const start = Date.now();
    const history = await sessionManager.getSessionHistory('history-project');
    const duration = Date.now() - start;

    expect(history).toHaveLength(500);
    expect(duration).toBeLessThan(1_000);
  });

  // ── Persistence with large data ────────────────────────────

  test('save and load with many sessions', async () => {
    const { store, sessionManager } = buildSystem();

    // Create 200 sessions with captures
    for (let i = 0; i < 200; i++) {
      const session = await sessionManager.createSession(`project-${i % 10}`);
      await sessionManager.closeSession(
        session.id,
        new Date(session.entryTime.getTime() + 60_000)
      );
      await store.saveCapture({
        id: `cap-${i}`,
        sessionId: session.id,
        type: 'quick',
        originalInput: `Capture ${i}: Working on task ${i}`,
        contextElements: {
          intent: [`task ${i}`],
          originalInput: `Capture ${i}`,
        },
        timestamp: new Date(),
      });
    }

    // Save
    const saveStart = Date.now();
    await store.save();
    const saveDuration = Date.now() - saveStart;
    expect(saveDuration).toBeLessThan(5_000);

    // Verify data integrity
    const sessions = await store.getSessionsByProject('project-0');
    expect(sessions.length).toBeGreaterThan(0);
    const session = await store.getSession(sessions[0].id);
    expect(session).not.toBeNull();
  });
});
