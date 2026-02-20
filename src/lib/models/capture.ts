/**
 * Structured context extracted from capture input.
 *
 * Invariants:
 * - originalInput must always be present and non-empty
 * - Empty arrays should be represented as undefined
 */
export interface ContextElements {
  intent?: string[];
  lastAction?: string[];
  openLoops?: string[];
  nextAction?: string[];
  originalInput: string;
}

/**
 * Context captured during a session exit.
 *
 * Invariants:
 * - id must be unique across all captures
 * - sessionId must reference a valid session
 * - originalInput must be preserved verbatim
 * - type must be either 'quick' or 'interrupt'
 */
export interface Capture {
  id: string;
  sessionId: string;
  type: 'quick' | 'interrupt';
  originalInput: string;
  contextElements: ContextElements;
  timestamp: Date;
}

export interface CaptureSession {
  id: string;
  sessionId: string;
  type: 'quick' | 'interrupt';
  startTime: Date;
  timeoutMs: number;
}

export interface CaptureResult {
  success: boolean;
  captureId: string;
  extractedContext: ContextElements;
  originalInput: string;
  timestamp: Date;
  error?: string;
}
