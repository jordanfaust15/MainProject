import {
  CaptureSession,
  CaptureResult,
  Capture,
} from '../models';
import { ContextExtractor } from '../extraction';
import { VoiceInputProcessor } from '../voice';
import { SessionManager } from '../session';
import { IDataStore } from '../storage';

const QUICK_CAPTURE_TIMEOUT_MS = 30_000;
const INTERRUPT_CAPTURE_TIMEOUT_MS = 2_000;

export class CaptureModule {
  constructor(
    private readonly extractor: ContextExtractor,
    private readonly voiceProcessor: VoiceInputProcessor,
    private readonly sessionManager: SessionManager,
    private readonly store: IDataStore
  ) {}

  // ── Initiation ─────────────────────────────────────────────

  startQuickCapture(sessionId: string): CaptureSession {
    return {
      id: globalThis.crypto.randomUUID(),
      sessionId,
      type: 'quick',
      startTime: new Date(),
      timeoutMs: QUICK_CAPTURE_TIMEOUT_MS,
    };
  }

  startInterruptCapture(sessionId: string): CaptureSession {
    return {
      id: globalThis.crypto.randomUUID(),
      sessionId,
      type: 'interrupt',
      startTime: new Date(),
      timeoutMs: INTERRUPT_CAPTURE_TIMEOUT_MS,
    };
  }

  // ── Text submission ────────────────────────────────────────

  async submitTextCapture(
    captureSession: CaptureSession,
    text: string
  ): Promise<CaptureResult> {
    return this.processCapture(captureSession, text);
  }

  // ── Voice submission ───────────────────────────────────────

  async submitVoiceCapture(
    captureSession: CaptureSession,
    audioData: ArrayBuffer
  ): Promise<CaptureResult> {
    const transcription = await this.voiceProcessor.transcribe(audioData);

    if (!transcription.success) {
      return {
        success: false,
        captureId: '',
        extractedContext: {
          originalInput: '',
        },
        originalInput: '',
        timestamp: new Date(),
        error: transcription.error ?? 'Transcription failed',
      };
    }

    return this.processCapture(captureSession, transcription.text);
  }

  // ── Core processing ────────────────────────────────────────

  private async processCapture(
    captureSession: CaptureSession,
    text: string
  ): Promise<CaptureResult> {
    const timestamp = new Date();

    // Extract context elements
    const contextElements = this.extractor.extract(text);

    // Build capture record
    const capture: Capture = {
      id: globalThis.crypto.randomUUID(),
      sessionId: captureSession.sessionId,
      type: captureSession.type,
      originalInput: text,
      contextElements,
      timestamp,
    };

    // Persist capture
    await this.store.saveCapture(capture);

    // Update session with capture reference and exit timestamp
    const session = await this.store.getSession(captureSession.sessionId);
    if (session) {
      session.captureId = capture.id;
      session.exitTime = timestamp;
      await this.store.saveSession(session);
    }

    // Immediate save for capture completion (critical operation)
    await this.store.immediateSave();

    return {
      success: true,
      captureId: capture.id,
      extractedContext: contextElements,
      originalInput: text,
      timestamp,
    };
  }

  // ── Timing helpers ─────────────────────────────────────────

  /**
   * Check if a capture session has timed out.
   */
  isTimedOut(captureSession: CaptureSession): boolean {
    const elapsed = Date.now() - captureSession.startTime.getTime();
    return elapsed >= captureSession.timeoutMs;
  }

  /**
   * Get remaining time in milliseconds.
   */
  getRemainingTime(captureSession: CaptureSession): number {
    const elapsed = Date.now() - captureSession.startTime.getTime();
    return Math.max(0, captureSession.timeoutMs - elapsed);
  }
}
