import { Session, TimeAwayDisplay } from '../models';
import { IDataStore } from '../storage';

export class SessionManager {
  constructor(private readonly store: IDataStore) {}

  // ── Session lifecycle ──────────────────────────────────────

  async createSession(projectId: string): Promise<Session> {
    const session: Session = {
      id: globalThis.crypto.randomUUID(),
      projectId,
      entryTime: new Date(),
    };

    await this.store.saveSession(session);
    return session;
  }

  async closeSession(sessionId: string, exitTime: Date): Promise<void> {
    const session = await this.store.getSession(sessionId);
    if (!session) return;

    // Reject exit time before entry time
    if (exitTime < session.entryTime) return;

    session.exitTime = exitTime;
    await this.store.saveSession(session);
    await this.store.immediateSave();
  }

  // ── Queries ────────────────────────────────────────────────

  async getMostRecentSession(
    projectId: string
  ): Promise<Session | null> {
    const sessions = await this.store.getSessionsByProject(projectId);
    if (sessions.length === 0) return null;

    return sessions.reduce((latest, s) =>
      s.entryTime > latest.entryTime ? s : latest
    );
  }

  async getSessionHistory(projectId: string): Promise<Session[]> {
    const sessions = await this.store.getSessionsByProject(projectId);
    return sessions.sort(
      (a, b) => b.entryTime.getTime() - a.entryTime.getTime()
    );
  }

  // ── Time away ──────────────────────────────────────────────

  async calculateTimeAway(sessionId: string): Promise<TimeAwayDisplay> {
    const session = await this.store.getSession(sessionId);
    if (!session || !session.exitTime) {
      return { value: 0, unit: 'unknown', formatted: 'unknown' };
    }

    return SessionManager.computeTimeAway(session.exitTime, new Date());
  }

  /**
   * Pure function for computing time away from two timestamps.
   * Exposed as static for direct testing.
   */
  static computeTimeAway(
    exitTime: Date,
    currentTime: Date
  ): TimeAwayDisplay {
    const diffMs = currentTime.getTime() - exitTime.getTime();

    if (diffMs < 0) {
      return { value: 0, unit: 'unknown', formatted: 'unknown' };
    }

    const diffMinutes = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMinutes < 60) {
      return {
        value: diffMinutes,
        unit: 'minutes',
        formatted: `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`,
      };
    } else if (diffHours < 48) {
      return {
        value: diffHours,
        unit: 'hours',
        formatted: `${diffHours} hour${diffHours !== 1 ? 's' : ''}`,
      };
    } else {
      return {
        value: diffDays,
        unit: 'days',
        formatted: `${diffDays} day${diffDays !== 1 ? 's' : ''}`,
      };
    }
  }
}
