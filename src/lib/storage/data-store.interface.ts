import { Session, Capture } from '../models';

export type FailureListener = (error: Error) => void;

export interface IDataStore {
  saveSession(session: Session): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
  getSessionsByProject(projectId: string): Promise<Session[]>;
  saveCapture(capture: Capture): Promise<void>;
  getCapture(captureId: string): Promise<Capture | null>;
  saveFeedback(sessionId: string, rating: number, timestamp: Date): Promise<void>;
  save(): Promise<void>;
  immediateSave(): Promise<void>;
  startAutoSave(): void;
  stopAutoSave(): void;
  onFailure(listener: FailureListener): void;
  _reset(): void;
  _isDirty(): boolean;
}
