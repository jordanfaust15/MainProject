/**
 * Represents a continuous period of work on a project.
 *
 * Invariants:
 * - id must be unique across all sessions
 * - entryTime must be a valid timestamp
 * - If exitTime exists, it must be >= entryTime
 * - If feedbackTime exists, feedbackRating must also exist
 */
export interface Session {
  id: string;
  projectId: string;
  entryTime: Date;
  exitTime?: Date;
  captureId?: string;
  feedbackRating?: number;
  feedbackTime?: Date;
}

export interface TimeAwayDisplay {
  value: number;
  unit: 'minutes' | 'hours' | 'days' | 'unknown';
  formatted: string;
}
