import { Session, CaptureSession, CaptureResult, RestartBriefing } from '../models';

export interface ReentryAPI {
  createSession(projectId: string): Promise<Session>;
  closeSession(sessionId: string): Promise<void>;
  getMostRecentSession(projectId: string): Promise<Session | null>;
  getSessionHistory(projectId: string): Promise<Session[]>;

  startQuickCapture(sessionId: string): Promise<CaptureSession>;
  startInterruptCapture(sessionId: string): Promise<CaptureSession>;
  submitTextCapture(captureSessionId: string, text: string): Promise<CaptureResult>;

  generateBriefing(sessionId: string): Promise<RestartBriefing>;
  generateBriefingForProject(projectId: string): Promise<RestartBriefing | null>;
  formatBriefingCard(briefing: RestartBriefing): Promise<string>;

  submitFeedback(sessionId: string, rating: number): Promise<void>;

  onInterruptCaptureTrigger(callback: () => void): void;
}

declare global {
  interface Window {
    reentryAPI: ReentryAPI;
  }
}
