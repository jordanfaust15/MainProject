import { RecordingSession, TranscriptionResult } from '../models';

/** Abstraction over the platform audio recording API. */
export interface AudioRecorder {
  /** Request microphone access. Throws if denied. */
  requestPermission(): Promise<void>;
  /** Start recording. Returns a stream of audio level values (0–1). */
  start(onAudioLevel: (level: number) => void): Promise<void>;
  /** Stop recording and return the captured audio. */
  stop(): Promise<ArrayBuffer>;
}

/** Abstraction over speech-to-text transcription. */
export interface TranscriptionService {
  transcribe(audio: ArrayBuffer): Promise<TranscriptionResult>;
}

export const SILENCE_THRESHOLD_MS = 2000;
export const SILENCE_LEVEL = 0.01; // Audio levels below this are considered silence

export type RecordingStateListener = (state: {
  isRecording: boolean;
  audioLevel: number;
}) => void;

/**
 * Manages voice recording lifecycle, silence detection, and transcription.
 */
export class VoiceInputProcessor {
  private currentSession: RecordingSession | null = null;
  private silenceStart: number | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private stateListeners: RecordingStateListener[] = [];
  private resolveStop: ((audio: ArrayBuffer) => void) | null = null;

  constructor(
    private readonly recorder: AudioRecorder,
    private readonly transcriptionService: TranscriptionService
  ) {}

  // ── Recording lifecycle ────────────────────────────────────

  async startRecording(): Promise<RecordingSession> {
    await this.recorder.requestPermission();

    const session: RecordingSession = {
      id: globalThis.crypto.randomUUID(),
      startTime: new Date(),
      isActive: true,
    };

    this.currentSession = session;
    this.silenceStart = null;

    await this.recorder.start((level) => {
      this.handleAudioLevel(level);
    });

    this.notifyState(true, 0);
    return session;
  }

  async stopRecording(): Promise<ArrayBuffer> {
    if (!this.currentSession || !this.currentSession.isActive) {
      throw new Error('No active recording session');
    }

    this.clearSilenceTimer();
    this.currentSession.isActive = false;
    const audio = await this.recorder.stop();
    this.notifyState(false, 0);
    return audio;
  }

  async transcribe(audio: ArrayBuffer): Promise<TranscriptionResult> {
    return this.transcriptionService.transcribe(audio);
  }

  /**
   * Convenience: record until silence or manual stop, then transcribe.
   * Returns the transcription result.
   */
  async recordAndTranscribe(): Promise<TranscriptionResult> {
    await this.startRecording();

    const audio = await new Promise<ArrayBuffer>((resolve) => {
      this.resolveStop = resolve;
    });

    return this.transcribe(audio);
  }

  // ── State ──────────────────────────────────────────────────

  isRecording(): boolean {
    return this.currentSession?.isActive ?? false;
  }

  getSession(): RecordingSession | null {
    return this.currentSession;
  }

  onStateChange(listener: RecordingStateListener): void {
    this.stateListeners.push(listener);
  }

  // ── Silence detection ──────────────────────────────────────

  private handleAudioLevel(level: number): void {
    this.notifyState(true, level);

    if (level < SILENCE_LEVEL) {
      if (this.silenceStart === null) {
        this.silenceStart = Date.now();
        this.silenceTimer = setTimeout(() => {
          this.onSilenceDetected();
        }, SILENCE_THRESHOLD_MS);
      }
    } else {
      // Sound detected — reset silence tracking
      this.silenceStart = null;
      this.clearSilenceTimer();
    }
  }

  private async onSilenceDetected(): Promise<void> {
    if (!this.currentSession?.isActive) return;

    const audio = await this.stopRecording();
    if (this.resolveStop) {
      this.resolveStop(audio);
      this.resolveStop = null;
    }
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private notifyState(isRecording: boolean, audioLevel: number): void {
    for (const listener of this.stateListeners) {
      listener({ isRecording, audioLevel });
    }
  }
}
