import {
  Session,
  Capture,
  createEmptySchema,
  StorageSchema,
} from '../../src/lib/models';
import { IDataStore, FailureListener } from '../../src/lib/storage';

/**
 * In-memory IDataStore implementation for tests.
 * Replaces the fs-based DataStore in all test files.
 */
export class MockDataStore implements IDataStore {
  private data: StorageSchema;
  private dirty = false;
  private failureListeners: FailureListener[] = [];

  constructor() {
    this.data = createEmptySchema();
  }

  async saveSession(session: Session): Promise<void> {
    this.data.sessions[session.id] = session;

    if (!this.data.sessionsByProject[session.projectId]) {
      this.data.sessionsByProject[session.projectId] = [];
    }
    const projectSessions = this.data.sessionsByProject[session.projectId];
    if (!projectSessions.includes(session.id)) {
      projectSessions.push(session.id);
    }

    this.dirty = true;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.data.sessions[sessionId] ?? null;
  }

  async getSessionsByProject(projectId: string): Promise<Session[]> {
    const ids = this.data.sessionsByProject[projectId] ?? [];
    return ids
      .map((id) => this.data.sessions[id])
      .filter((s): s is Session => s !== undefined);
  }

  async saveCapture(capture: Capture): Promise<void> {
    this.data.captures[capture.id] = capture;
    this.dirty = true;
  }

  async getCapture(captureId: string): Promise<Capture | null> {
    return this.data.captures[captureId] ?? null;
  }

  async saveFeedback(
    sessionId: string,
    rating: number,
    timestamp: Date
  ): Promise<void> {
    const session = this.data.sessions[sessionId];
    if (!session) return;
    session.feedbackRating = rating;
    session.feedbackTime = timestamp;
    this.dirty = true;
  }

  async save(): Promise<void> {
    this.dirty = false;
  }

  async immediateSave(): Promise<void> {
    this.dirty = false;
  }

  startAutoSave(): void {}

  stopAutoSave(): void {}

  onFailure(listener: FailureListener): void {
    this.failureListeners.push(listener);
  }

  _reset(): void {
    this.data = createEmptySchema();
    this.dirty = false;
  }

  _isDirty(): boolean {
    return this.dirty;
  }
}
