import { SupabaseClient } from '@supabase/supabase-js';
import { Session, Capture, ContextElements } from '../models';
import { IDataStore, FailureListener } from './data-store.interface';

// ── Row types (snake_case from Supabase) ─────────────────────

interface SessionRow {
  id: string;
  project_id: string;
  entry_time: string;
  exit_time: string | null;
  capture_id: string | null;
  feedback_rating: number | null;
  feedback_time: string | null;
}

interface CaptureRow {
  id: string;
  session_id: string;
  type: string;
  original_input: string;
  context_elements: ContextElements;
  timestamp: string;
}

// ── Row <-> Model mappers ────────────────────────────────────

function sessionFromRow(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    entryTime: new Date(row.entry_time),
    exitTime: row.exit_time ? new Date(row.exit_time) : undefined,
    captureId: row.capture_id ?? undefined,
    feedbackRating: row.feedback_rating ?? undefined,
    feedbackTime: row.feedback_time ? new Date(row.feedback_time) : undefined,
  };
}

function sessionToRow(session: Session): SessionRow {
  return {
    id: session.id,
    project_id: session.projectId,
    entry_time: session.entryTime.toISOString(),
    exit_time: session.exitTime?.toISOString() ?? null,
    capture_id: session.captureId ?? null,
    feedback_rating: session.feedbackRating ?? null,
    feedback_time: session.feedbackTime?.toISOString() ?? null,
  };
}

function captureFromRow(row: CaptureRow): Capture {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type as 'quick' | 'interrupt',
    originalInput: row.original_input,
    contextElements: row.context_elements,
    timestamp: new Date(row.timestamp),
  };
}

function captureToRow(capture: Capture): CaptureRow {
  return {
    id: capture.id,
    session_id: capture.sessionId,
    type: capture.type,
    original_input: capture.originalInput,
    context_elements: capture.contextElements,
    timestamp: capture.timestamp.toISOString(),
  };
}

// ── SupabaseDataStore ────────────────────────────────────────

export class SupabaseDataStore implements IDataStore {
  private failureListeners: FailureListener[] = [];

  constructor(private readonly client: SupabaseClient) {}

  async saveSession(session: Session): Promise<void> {
    const { error } = await this.client
      .from('sessions')
      .upsert(sessionToRow(session));

    if (error) {
      this.notifyFailure(new Error(error.message));
    }
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) return null;
    return sessionFromRow(data as SessionRow);
  }

  async getSessionsByProject(projectId: string): Promise<Session[]> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('project_id', projectId);

    if (error || !data) return [];
    return (data as SessionRow[]).map(sessionFromRow);
  }

  async saveCapture(capture: Capture): Promise<void> {
    const { error } = await this.client
      .from('captures')
      .upsert(captureToRow(capture));

    if (error) {
      this.notifyFailure(new Error(error.message));
    }
  }

  async getCapture(captureId: string): Promise<Capture | null> {
    const { data, error } = await this.client
      .from('captures')
      .select('*')
      .eq('id', captureId)
      .single();

    if (error || !data) return null;
    return captureFromRow(data as CaptureRow);
  }

  async saveFeedback(
    sessionId: string,
    rating: number,
    timestamp: Date
  ): Promise<void> {
    const { error } = await this.client
      .from('sessions')
      .update({
        feedback_rating: rating,
        feedback_time: timestamp.toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      this.notifyFailure(new Error(error.message));
    }
  }

  // No-ops: Supabase persists on every write
  async save(): Promise<void> {}
  async immediateSave(): Promise<void> {}
  startAutoSave(): void {}
  stopAutoSave(): void {}

  onFailure(listener: FailureListener): void {
    this.failureListeners.push(listener);
  }

  _reset(): void {
    // No-op for Supabase (used in tests only)
  }

  _isDirty(): boolean {
    return false;
  }

  private notifyFailure(error: Error): void {
    for (const listener of this.failureListeners) {
      listener(error);
    }
  }
}
