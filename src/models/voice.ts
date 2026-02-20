export interface RecordingSession {
  id: string;
  startTime: Date;
  isActive: boolean;
}

export interface TranscriptionResult {
  success: boolean;
  text: string;
  confidence: number;
  error?: string;
}
