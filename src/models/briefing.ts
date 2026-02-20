import { TimeAwayDisplay } from './session';

/**
 * Briefing card displayed to users on re-entry.
 *
 * Invariants:
 * - sessionId must reference a valid session
 * - If hasCapture is false, reconstructionGuidance should be present
 * - missingElements should list all undefined context element fields
 * - generatedAt must be a valid timestamp
 */
export interface RestartBriefing {
  sessionId: string;
  intent?: string[];
  lastAction?: string[];
  openLoops?: string[];
  nextAction?: string[];
  timeAway: TimeAwayDisplay;
  missingElements: string[];
  hasCapture: boolean;
  reconstructionGuidance?: string;
  generatedAt: Date;
}
