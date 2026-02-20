import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DataStore } from '../../src/storage/data-store';
import { SessionManager } from '../../src/session/session-manager';
import { ContextExtractor } from '../../src/extraction/context-extractor';
import { CaptureModule } from '../../src/capture/capture-module';
import { BriefingGenerator } from '../../src/briefing/briefing-generator';
import {
  VoiceInputProcessor,
  AudioRecorder,
  TranscriptionService,
} from '../../src/voice/voice-processor';
import { TranscriptionResult } from '../../src/models';

// ── Mocks ────────────────────────────────────────────────────

class MockRecorder implements AudioRecorder {
  async requestPermission(): Promise<void> {}
  async start(): Promise<void> {}
  async stop(): Promise<ArrayBuffer> { return new ArrayBuffer(512); }
}

class MockTranscription implements TranscriptionService {
  text = 'I was debugging the auth flow. Found the bug in token refresh. Need to check edge cases. Next I should write regression tests.';
  async transcribe(): Promise<TranscriptionResult> {
    return { success: true, text: this.text, confidence: 0.95 };
  }
}

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reentry-integ-'));
}

function buildSystem(dir: string) {
  const store = new DataStore(dir);
  const sessionManager = new SessionManager(store);
  const extractor = new ContextExtractor();
  const mockTranscription = new MockTranscription();
  const voiceProcessor = new VoiceInputProcessor(new MockRecorder(), mockTranscription);
  const captureModule = new CaptureModule(extractor, voiceProcessor, sessionManager, store);
  const briefingGenerator = new BriefingGenerator(store, sessionManager);
  return { store, sessionManager, captureModule, briefingGenerator, mockTranscription };
}

describe('Integration: Capture → Briefing Flow', () => {
  let dir: string;

  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  test('planned exit: text capture → return → complete briefing', async () => {
    const { store, sessionManager, captureModule, briefingGenerator } = buildSystem(dir);

    // 1. Start working on a project
    const session = await sessionManager.createSession('my-project');
    expect(session.id).toBeDefined();

    // 2. Time passes, user decides to leave - quick capture
    const capSession = captureModule.startQuickCapture(session.id);
    const result = await captureModule.submitTextCapture(
      capSession,
      'I was debugging the login flow. Fixed the session timeout bug. ' +
      'Need to check the remember-me feature. Next I should add integration tests.'
    );
    expect(result.success).toBe(true);
    expect(result.extractedContext.intent).toBeDefined();

    // 3. Session should now have exit time and capture reference
    const closedSession = await store.getSession(session.id);
    expect(closedSession!.exitTime).toBeDefined();
    expect(closedSession!.captureId).toBe(result.captureId);

    // 4. User returns - generate briefing
    const briefing = await briefingGenerator.generateBriefing(session.id);
    expect(briefing.hasCapture).toBe(true);
    expect(briefing.sessionId).toBe(session.id);
    expect(briefing.intent).toBeDefined();
    expect(briefing.timeAway).toBeDefined();
    expect(briefing.generatedAt).toBeInstanceOf(Date);

    // 5. Briefing card can be formatted
    const card = briefingGenerator.formatBriefingCard(briefing);
    expect(card).toContain('RESTART BRIEFING');
    expect(card).toContain('Away for:');
  });

  test('interrupt exit: quick capture → return → briefing', async () => {
    const { sessionManager, captureModule, briefingGenerator } = buildSystem(dir);

    const session = await sessionManager.createSession('urgent-project');
    const capSession = captureModule.startInterruptCapture(session.id);

    const result = await captureModule.submitTextCapture(
      capSession,
      'Debugging the payment bug.'
    );
    expect(result.success).toBe(true);

    const briefing = await briefingGenerator.generateBriefing(session.id);
    expect(briefing.hasCapture).toBe(true);
    expect(briefing.timeAway).toBeDefined();
  });

  test('voice capture → transcription → extraction → briefing', async () => {
    const { sessionManager, captureModule, briefingGenerator } = buildSystem(dir);

    const session = await sessionManager.createSession('voice-project');
    const capSession = captureModule.startQuickCapture(session.id);

    // Submit voice (uses mock transcription)
    const result = await captureModule.submitVoiceCapture(
      capSession,
      new ArrayBuffer(1024)
    );
    expect(result.success).toBe(true);
    expect(result.extractedContext.intent).toBeDefined();

    const briefing = await briefingGenerator.generateBriefing(session.id);
    expect(briefing.hasCapture).toBe(true);
    expect(briefing.intent).toBeDefined();
  });

  test('no capture → return → partial briefing with guidance', async () => {
    const { store, sessionManager, briefingGenerator } = buildSystem(dir);

    const session = await sessionManager.createSession('forgot-project');
    // Backdate entry time so exit is in the past
    const pastEntry = new Date(Date.now() - 7_200_000); // 2 hours ago
    const pastExit = new Date(Date.now() - 3_600_000);  // 1 hour ago
    const storedSession = await store.getSession(session.id);
    storedSession!.entryTime = pastEntry;
    await store.saveSession(storedSession!);
    await sessionManager.closeSession(session.id, pastExit);

    // User returns without having captured anything
    const briefing = await briefingGenerator.generateBriefing(session.id);

    expect(briefing.hasCapture).toBe(false);
    expect(briefing.missingElements).toHaveLength(4);
    expect(briefing.reconstructionGuidance).toBeDefined();
    expect(briefing.timeAway).toBeDefined();
    expect(briefing.timeAway.unit).not.toBe('unknown');
  });

  test('multi-project session isolation', async () => {
    const { sessionManager, captureModule, briefingGenerator } = buildSystem(dir);

    // Project A
    const sessionA = await sessionManager.createSession('project-a');
    const capA = captureModule.startQuickCapture(sessionA.id);
    await captureModule.submitTextCapture(capA, 'Working on project A frontend.');

    // Project B
    const sessionB = await sessionManager.createSession('project-b');
    const capB = captureModule.startQuickCapture(sessionB.id);
    await captureModule.submitTextCapture(capB, 'Debugging project B backend.');

    // Briefings should be isolated
    const briefingA = await briefingGenerator.generateBriefingForProject('project-a');
    const briefingB = await briefingGenerator.generateBriefingForProject('project-b');

    expect(briefingA).not.toBeNull();
    expect(briefingB).not.toBeNull();
    expect(briefingA!.sessionId).toBe(sessionA.id);
    expect(briefingB!.sessionId).toBe(sessionB.id);
  });

  test('feedback submission → storage → retrieval', async () => {
    const { store, sessionManager, briefingGenerator } = buildSystem(dir);

    const session = await sessionManager.createSession('feedback-project');
    const capSession = briefingGenerator; // just use generator for feedback

    await briefingGenerator.submitFeedback(session.id, 4);

    const updated = await store.getSession(session.id);
    expect(updated!.feedbackRating).toBe(4);
    expect(updated!.feedbackTime).toBeInstanceOf(Date);
  });

  test('application restart preserves data', async () => {
    const sys1 = buildSystem(dir);

    // Create session and capture in "first run"
    const session = await sys1.sessionManager.createSession('persist-project');
    const capSession = sys1.captureModule.startQuickCapture(session.id);
    await sys1.captureModule.submitTextCapture(capSession, 'Working on persistence.');

    // Ensure saved
    await sys1.store.immediateSave();

    // "Restart" — new instances loading from disk
    const sys2 = buildSystem(dir);
    await sys2.store.load();

    const briefing = await sys2.briefingGenerator.generateBriefing(session.id);
    expect(briefing.hasCapture).toBe(true);
    expect(briefing.timeAway).toBeDefined();
  });

  test('multiple captures across sessions for same project', async () => {
    const { sessionManager, captureModule, briefingGenerator } = buildSystem(dir);

    // First work session
    const s1 = await sessionManager.createSession('multi-session');
    const c1 = captureModule.startQuickCapture(s1.id);
    await captureModule.submitTextCapture(c1, 'I was building the API layer.');

    // Second work session
    await new Promise((r) => setTimeout(r, 10));
    const s2 = await sessionManager.createSession('multi-session');
    const c2 = captureModule.startQuickCapture(s2.id);
    await captureModule.submitTextCapture(c2, 'Debugging the database queries.');

    // Briefing should be for the most recent session
    const briefing = await briefingGenerator.generateBriefingForProject('multi-session');
    expect(briefing).not.toBeNull();
    expect(briefing!.sessionId).toBe(s2.id);
  });
});
