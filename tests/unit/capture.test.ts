import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CaptureModule } from '../../src/capture/capture-module';
import { ContextExtractor } from '../../src/extraction/context-extractor';
import {
  VoiceInputProcessor,
  AudioRecorder,
  TranscriptionService,
} from '../../src/voice/voice-processor';
import { SessionManager } from '../../src/session/session-manager';
import { DataStore } from '../../src/storage/data-store';
import { TranscriptionResult } from '../../src/models';

// ── Mock voice dependencies ──────────────────────────────────

class MockRecorder implements AudioRecorder {
  async requestPermission(): Promise<void> {}
  async start(): Promise<void> {}
  async stop(): Promise<ArrayBuffer> {
    return new ArrayBuffer(512);
  }
}

class MockTranscription implements TranscriptionService {
  result: TranscriptionResult = {
    success: true,
    text: 'I was debugging the auth flow. Next I should write tests.',
    confidence: 0.95,
  };

  async transcribe(): Promise<TranscriptionResult> {
    return this.result;
  }
}

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reentry-cap-'));
}

describe('CaptureModule', () => {
  let dir: string;
  let store: DataStore;
  let sessionManager: SessionManager;
  let extractor: ContextExtractor;
  let voiceProcessor: VoiceInputProcessor;
  let mockTranscription: MockTranscription;
  let captureModule: CaptureModule;

  beforeEach(async () => {
    dir = tmpDir();
    store = new DataStore(dir);
    sessionManager = new SessionManager(store);
    extractor = new ContextExtractor();
    mockTranscription = new MockTranscription();
    voiceProcessor = new VoiceInputProcessor(
      new MockRecorder(),
      mockTranscription
    );
    captureModule = new CaptureModule(
      extractor,
      voiceProcessor,
      sessionManager,
      store
    );
  });

  afterEach(() => {
    store.stopAutoSave();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ── Quick capture ──────────────────────────────────────────

  test('starts quick capture with 30s timeout', () => {
    const session = captureModule.startQuickCapture('sess-1');

    expect(session.id).toBeDefined();
    expect(session.sessionId).toBe('sess-1');
    expect(session.type).toBe('quick');
    expect(session.timeoutMs).toBe(30_000);
    expect(session.startTime).toBeInstanceOf(Date);
  });

  test('submits text capture and extracts context', async () => {
    const session = await sessionManager.createSession('proj-1');
    const capSession = captureModule.startQuickCapture(session.id);

    const result = await captureModule.submitTextCapture(
      capSession,
      'I was debugging the auth flow. Next I should write tests.'
    );

    expect(result.success).toBe(true);
    expect(result.captureId).toBeDefined();
    expect(result.originalInput).toBe(
      'I was debugging the auth flow. Next I should write tests.'
    );
    expect(result.extractedContext.intent).toBeDefined();
    expect(result.extractedContext.nextAction).toBeDefined();
    expect(result.extractedContext.originalInput).toBe(
      'I was debugging the auth flow. Next I should write tests.'
    );
  });

  test('submits voice capture via transcription', async () => {
    const session = await sessionManager.createSession('proj-1');
    const capSession = captureModule.startQuickCapture(session.id);

    const result = await captureModule.submitVoiceCapture(
      capSession,
      new ArrayBuffer(1024)
    );

    expect(result.success).toBe(true);
    expect(result.extractedContext.originalInput).toBe(
      'I was debugging the auth flow. Next I should write tests.'
    );
  });

  test('voice capture fails gracefully on transcription error', async () => {
    mockTranscription.result = {
      success: false,
      text: '',
      confidence: 0,
      error: 'Service unavailable',
    };

    const session = await sessionManager.createSession('proj-1');
    const capSession = captureModule.startQuickCapture(session.id);

    const result = await captureModule.submitVoiceCapture(
      capSession,
      new ArrayBuffer(1024)
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Service unavailable');
  });

  // ── Interrupt capture ──────────────────────────────────────

  test('starts interrupt capture with 2s timeout', () => {
    const session = captureModule.startInterruptCapture('sess-1');

    expect(session.type).toBe('interrupt');
    expect(session.timeoutMs).toBe(2_000);
  });

  test('interrupt capture processes single sentence', async () => {
    const session = await sessionManager.createSession('proj-1');
    const capSession = captureModule.startInterruptCapture(session.id);

    const result = await captureModule.submitTextCapture(
      capSession,
      'Debugging the login bug.'
    );

    expect(result.success).toBe(true);
    expect(result.captureId).toBeDefined();
  });

  // ── Session association ────────────────────────────────────

  test('capture is associated with session ID', async () => {
    const session = await sessionManager.createSession('proj-1');
    const capSession = captureModule.startQuickCapture(session.id);

    const result = await captureModule.submitTextCapture(
      capSession,
      'Working on the API.'
    );

    const capture = await store.getCapture(result.captureId);
    expect(capture).not.toBeNull();
    expect(capture!.sessionId).toBe(session.id);
  });

  test('session gets captureId and exitTime after capture', async () => {
    const session = await sessionManager.createSession('proj-1');
    const capSession = captureModule.startQuickCapture(session.id);

    const result = await captureModule.submitTextCapture(
      capSession,
      'Working on the API.'
    );

    const updatedSession = await store.getSession(session.id);
    expect(updatedSession!.captureId).toBe(result.captureId);
    expect(updatedSession!.exitTime).toBeDefined();
  });

  // ── Timing ─────────────────────────────────────────────────

  test('isTimedOut returns false for fresh capture session', () => {
    const capSession = captureModule.startQuickCapture('sess-1');
    expect(captureModule.isTimedOut(capSession)).toBe(false);
  });

  test('getRemainingTime returns positive value for fresh session', () => {
    const capSession = captureModule.startQuickCapture('sess-1');
    expect(captureModule.getRemainingTime(capSession)).toBeGreaterThan(0);
    expect(captureModule.getRemainingTime(capSession)).toBeLessThanOrEqual(30_000);
  });

  test('isTimedOut returns true for expired session', () => {
    const capSession = captureModule.startQuickCapture('sess-1');
    // Backdate the start time
    capSession.startTime = new Date(Date.now() - 31_000);

    expect(captureModule.isTimedOut(capSession)).toBe(true);
    expect(captureModule.getRemainingTime(capSession)).toBe(0);
  });

  // ── Persistence ────────────────────────────────────────────

  test('capture is persisted to store', async () => {
    const session = await sessionManager.createSession('proj-1');
    const capSession = captureModule.startQuickCapture(session.id);

    const result = await captureModule.submitTextCapture(
      capSession,
      'Testing persistence.'
    );

    // Verify it was saved (immediateSave called)
    const loaded = await store.getCapture(result.captureId);
    expect(loaded).not.toBeNull();
    expect(loaded!.originalInput).toBe('Testing persistence.');
  });

  // ── Original input preservation ────────────────────────────

  test('preserves original input verbatim with special chars', async () => {
    const session = await sessionManager.createSession('proj-1');
    const capSession = captureModule.startQuickCapture(session.id);

    const input = 'Working on <div> & "quotes" — em-dash…ellipsis  \n  tabs';
    const result = await captureModule.submitTextCapture(capSession, input);

    expect(result.originalInput).toBe(input);
    expect(result.extractedContext.originalInput).toBe(input);
  });
});
